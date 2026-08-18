<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class DocumentCode
{
    public static function next(string $table, string $column, string $prefix, int $pad = 3, bool $includeYear = true): string
    {
        $head = $includeYear ? $prefix.'-'.now()->year.'-' : $prefix.'-';

        $last = DB::table($table)
            ->where($column, 'like', $head.'%')
            ->orderByDesc('id')
            ->value($column);

        $n = 1;
        if (is_string($last) && preg_match('/(\d+)$/', $last, $matches) === 1) {
            $n = ((int) $matches[1]) + 1;
        }

        return $head.str_pad((string) $n, $pad, '0', STR_PAD_LEFT);
    }

    /**
     * @return list<string>
     */
    public static function nextMany(string $table, string $column, string $prefix, int $count, int $pad = 3, bool $includeYear = true): array
    {
        if ($count < 1) {
            return [];
        }

        $head = $includeYear ? $prefix.'-'.now()->year.'-' : $prefix.'-';

        $last = DB::table($table)
            ->where($column, 'like', $head.'%')
            ->orderByDesc('id')
            ->value($column);

        $n = 1;
        if (is_string($last) && preg_match('/(\d+)$/', $last, $matches) === 1) {
            $n = ((int) $matches[1]) + 1;
        }

        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = $head.str_pad((string) ($n + $i), $pad, '0', STR_PAD_LEFT);
        }

        return $codes;
    }
}
