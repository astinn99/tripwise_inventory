<?php

namespace App\Http\Requests;

use App\Models\InventoryItem;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AdjustInventoryItemRequest extends FormRequest
{
    public const TYPES = ['Damaged', 'Disposed', 'Lost', 'Return', 'ManualRelease'];

    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(self::TYPES)],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
            'source' => ['nullable', 'string', Rule::in(['available', 'damaged'])],
            'releasedTo' => ['required_if:type,ManualRelease', 'nullable', 'string', 'max:255'],
            'department' => ['required_if:type,ManualRelease', 'nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var InventoryItem|null $item */
            $item = $this->route('inventoryItem');
            if (! $item || $validator->errors()->isNotEmpty()) {
                return;
            }

            $type = (string) $this->input('type');
            $quantity = (int) $this->input('quantity');
            $source = $this->resolvedSource($item, $type);
            $available = $source === 'damaged'
                ? (int) $item->damaged_quantity
                : (int) $item->quantity;

            if ($quantity > $available) {
                $label = $source === 'damaged' ? 'quarantine' : 'available';
                $validator->errors()->add(
                    'quantity',
                    "Only {$available} unit(s) available in {$label} stock."
                );
            }
        });
    }

    public function resolvedSource(InventoryItem $item, ?string $type = null): string
    {
        $type ??= (string) $this->input('type');

        if (in_array($type, ['Damaged', 'Lost', 'ManualRelease'], true)) {
            return 'available';
        }

        $source = $this->input('source');
        if ($source === 'available' || $source === 'damaged') {
            return $source;
        }

        return (int) $item->damaged_quantity > 0 ? 'damaged' : 'available';
    }
}
