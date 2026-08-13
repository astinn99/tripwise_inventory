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
}
