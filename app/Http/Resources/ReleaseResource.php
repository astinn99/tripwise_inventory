<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Release */
class ReleaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->release_number,
            'requestId' => $this->request_id,
            'requestingDepartment' => $this->requesting_department,
            'itemCode' => $this->item_code,
            'itemName' => $this->item_name,
            'quantityReleased' => $this->quantity_released,
            'approvalStatus' => $this->approval_status,
            'stockStatus' => $this->stock_status,
            'releaseDate' => $this->release_date,
            'releasedTo' => $this->released_to,
            'dispatchedBy' => $this->dispatched_by,
        ];
    }
}
