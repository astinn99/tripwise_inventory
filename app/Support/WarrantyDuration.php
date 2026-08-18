<?php

namespace App\Support;

class WarrantyDuration
{
    public static function months(mixed $months = null, ?string $text = null): ?int
    {
        if (is_numeric($months) && (int) $months > 0) {
            return min((int) $months, 120);
        }

        if (! is_string($text) || trim($text) === '') {
            return null;
        }

        if (preg_match('/(\d+)\s*(year|yr)s?\b/i', $text, $matches) === 1) {
            return min((int) $matches[1] * 12, 120);
        }

        if (preg_match('/(\d+)\s*(month|mo)s?\b/i', $text, $matches) === 1) {
            return min((int) $matches[1], 120);
        }

        return null;
    }

    public static function label(?int $months, ?string $terms = null): ?string
    {
        $terms = is_string($terms) ? trim($terms) : '';
        $monthLabel = $months ? $months.' '.($months === 1 ? 'month' : 'months') : null;

        if ($monthLabel && $terms !== '' && strcasecmp($monthLabel, $terms) !== 0) {
            return $monthLabel.' · '.$terms;
        }

        return $monthLabel ?: ($terms !== '' ? $terms : null);
    }
}
