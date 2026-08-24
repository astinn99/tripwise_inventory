<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class DocumentCode
{
    public static function next(string $table, string $column, string $prefix, int $pad = 3, bool $includeYear = true): string
    {
        return self::nextMany($table, $column, $prefix, 1, $pad, $includeYear)[0];
    }

    /**
     * @return list<string>
     */
    public static function nextMany(string $table, string $column, string $prefix, int $count, int $pad = 3, bool $includeYear = true, int $offset = 0): array
    {
        if ($count < 1) {
            return [];
        }

        $head = $includeYear ? $prefix.'-'.now()->year.'-' : $prefix.'-';
        $n = self::nextSequence($table, $column, $head) + max(0, $offset);

        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = $head.str_pad((string) ($n + $i), $pad, '0', STR_PAD_LEFT);
        }

        return $codes;
    }

    private static function nextSequence(string $table, string $column, string $head): int
    {
        $codes = DB::table($table)
            ->where($column, 'like', $head.'%')
            ->pluck($column);

        $max = 0;
        $pattern = '/^'.preg_quote($head, '/').'(\d+)$/';

        foreach ($codes as $code) {
            if (is_string($code) && preg_match($pattern, $code, $matches) === 1) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $max + 1;
    }
}
