<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class Priority
{
    public const URGENT = 'URGENT';
    public const HIGH = 'HIGH';
    public const NORMAL = 'NORMAL';

    public const VALUES = [self::URGENT, self::HIGH, self::NORMAL];
    public const INPUTS = [self::URGENT, self::HIGH, self::NORMAL, 'MEDIUM', 'LOW'];

    public static function normalize(mixed $value): string
    {
        $raw = strtoupper(trim((string) $value));

        return match ($raw) {
            self::URGENT => self::URGENT,
            self::HIGH => self::HIGH,
            default => self::NORMAL,
        };
    }

    public static function rule(bool $required = false): array
    {
        $rule = $required ? ['required'] : ['nullable'];
        $rule[] = 'string';
        $rule[] = Rule::in(self::INPUTS);

        return $rule;
    }

    public static function sortIndex(mixed $value): int
    {
        return match (self::normalize($value)) {
            self::URGENT => 0,
            self::HIGH => 1,
            default => 2,
        };
    }

    public static function neededInDays(mixed $priority, mixed $override = null): int
    {
        if (is_numeric($override) && (int) $override >= 1) {
            return min((int) $override, 90);
        }

        return match (self::normalize($priority)) {
            self::URGENT => 3,
            self::HIGH => 7,
            default => 14,
        };
    }

    public static function displayDate(mixed $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }

        try {
            return \Illuminate\Support\Carbon::parse($date)->format('m/d/Y');
        } catch (\Throwable) {
            return (string) $date;
        }
    }

    public static function quoteDays(mixed $value): int
    {
        return match (self::normalize($value)) {
            self::URGENT => 2,
            self::HIGH => 5,
            default => 10,
        };
    }

    public static function confirmDays(mixed $value): int
    {
        return match (self::normalize($value)) {
            self::URGENT => 1,
            self::HIGH => 2,
            default => 3,
        };
    }

    public static function preferredMaxDeliveryDays(mixed $value): ?int
    {
        return match (self::normalize($value)) {
            self::URGENT => 3,
            self::HIGH => 7,
            default => null,
        };
    }

    public static function notificationSeverity(mixed $value): string
    {
        return match (self::normalize($value)) {
            self::URGENT => 'danger',
            self::HIGH => 'warning',
            default => 'info',
        };
    }

    public static function rankLabel(mixed $value): string
    {
        return match (self::normalize($value)) {
            self::URGENT => 'Fastest delivery',
            self::HIGH => 'Best balance',
            default => 'Best Price',
        };
    }

    /**
     * @param  Collection<int, mixed>  $opportunities
     * @return Collection<int, mixed>
     */
    public static function sortOpportunities(Collection $opportunities): Collection
    {
        return $opportunities->sort(function ($left, $right) {
            $rank = self::sortIndex(data_get($left, 'procurementRequest.priority') ?? data_get($left, 'priority'))
                <=> self::sortIndex(data_get($right, 'procurementRequest.priority') ?? data_get($right, 'priority'));
            if ($rank !== 0) {
                return $rank;
            }

            $leftDeadline = optional(data_get($left, 'deadline'))->timestamp ?? PHP_INT_MAX;
            $rightDeadline = optional(data_get($right, 'deadline'))->timestamp ?? PHP_INT_MAX;
            if ($leftDeadline !== $rightDeadline) {
                return $leftDeadline <=> $rightDeadline;
            }

            return ((int) data_get($right, 'id', 0)) <=> ((int) data_get($left, 'id', 0));
        })->values();
    }

    /**
     * @param  Collection<int, mixed>  $items
     * @return Collection<int, mixed>
     */
    public static function sortRecords(Collection $items, string $priorityKey = 'priority'): Collection
    {
        return $items->sort(function ($left, $right) use ($priorityKey) {
            $rank = self::sortIndex(data_get($left, $priorityKey) ?? data_get($left, 'purchaseOrder.priority'))
                <=> self::sortIndex(data_get($right, $priorityKey) ?? data_get($right, 'purchaseOrder.priority'));
            if ($rank !== 0) {
                return $rank;
            }

            return ((int) data_get($right, 'id', 0)) <=> ((int) data_get($left, 'id', 0));
        })->values();
    }

    /**
     * Rank supplier quotes so urgent stock is awarded on speed, not just price.
     *
     * @param  list<array{id: mixed, totalPrice?: float|int|string, deliveryTimeDays?: int|string, warrantyMonths?: int|string|null}>  $quotes
     * @return list<array{id: mixed, totalPrice?: float|int|string, deliveryTimeDays?: int|string, warrantyMonths?: int|string|null}>
     */
    public static function rankQuotes(array $quotes, mixed $priority): array
    {
        if ($quotes === []) {
            return [];
        }

        $level = self::normalize($priority);
        $prices = array_map(fn (array $quote) => (float) ($quote['totalPrice'] ?? 0), $quotes);
        $days = array_map(fn (array $quote) => (int) ($quote['deliveryTimeDays'] ?? 0), $quotes);
        $maxPrice = max(1, ...($prices ?: [1]));
        $maxDays = max(1, ...($days ?: [1]));

        usort($quotes, function (array $left, array $right) use ($level, $maxPrice, $maxDays) {
            if ($level === self::URGENT) {
                $days = ((int) ($left['deliveryTimeDays'] ?? 999)) <=> ((int) ($right['deliveryTimeDays'] ?? 999));
                if ($days !== 0) {
                    return $days;
                }

                $price = ((float) ($left['totalPrice'] ?? 0)) <=> ((float) ($right['totalPrice'] ?? 0));
                if ($price !== 0) {
                    return $price;
                }

                return ((int) ($right['warrantyMonths'] ?? 0)) <=> ((int) ($left['warrantyMonths'] ?? 0));
            }

            if ($level === self::HIGH) {
                $score = fn (array $quote) => (((int) ($quote['deliveryTimeDays'] ?? 0)) / $maxDays)
                    + (((float) ($quote['totalPrice'] ?? 0)) / $maxPrice);
                $diff = $score($left) <=> $score($right);
                if ($diff !== 0) {
                    return $diff;
                }

                return ((int) ($right['warrantyMonths'] ?? 0)) <=> ((int) ($left['warrantyMonths'] ?? 0));
            }

            $price = ((float) ($left['totalPrice'] ?? 0)) <=> ((float) ($right['totalPrice'] ?? 0));
            if ($price !== 0) {
                return $price;
            }

            return ((int) ($left['deliveryTimeDays'] ?? 0)) <=> ((int) ($right['deliveryTimeDays'] ?? 0));
        });

        return array_values($quotes);
    }
}
