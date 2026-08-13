<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'document_number', 'title', 'type', 'reference_number', 'supplier',
    'issue_date', 'expiration_date', 'status', 'category', 'file_size',
])]
class Document extends Model
{
    use SoftDeletes;

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'expiration_date' => 'date',
        ];
    }

    public function resolveStatus(): string
    {
        if (! $this->expiration_date) {
            return $this->status ?: 'Active';
        }

        if ($this->expiration_date->isPast()) {
            return 'Expired';
        }

        if ($this->expiration_date->lte(now()->addDays(30))) {
            return 'Expiring Soon';
        }

        return 'Active';
    }
}
