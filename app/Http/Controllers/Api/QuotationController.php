<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\QuotationSubmitRequest;
use App\Http\Requests\QuotationUpdateRequest;
use App\Http\Requests\QuotationUploadRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\QuotationResource;
use App\Models\ProcurementRequest;
use App\Models\Quotation;
use App\Services\QuotationUploadService;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class QuotationController extends Controller
{
    public function index(Request $request)
    {
        $query = Quotation::query()->with(['procurementRequest.catalogItem', 'supplier'])->orderByDesc('id');

        if ($request->user()->isSupplier() && $request->user()->supplier_id) {
            $query->where('supplier_id', $request->user()->supplier_id);
        }

        return $this->ok(QuotationResource::collection($query->get()));
    }

    public function upload(QuotationUploadRequest $request, QuotationUploadService $uploads)
    {
        $data = $request->validated();
        $user = $request->user();

        if ($data['step'] === 'start') {
            return $this->ok($uploads->start($user, $data['kind'], $data['fileName']), 'Upload started');
        }

        if ($data['step'] === 'chunk') {
            $uploads->append($user, $data['uploadId'], $data['chunkBase64']);

            return $this->ok(['uploadId' => $data['uploadId']], 'Chunk stored');
        }

        if ($data['step'] === 'complete') {
            $file = $request->file('file');
            if ($file) {
                return $this->ok($uploads->completeFromUpload($user, $data['kind'], $file), 'Upload finished');
            }

            $contents = base64_decode((string) ($data['chunkBase64'] ?? ''), true);
            if ($contents === false) {
                return $this->fail('The file could not be processed.', 422, [
                    'chunkBase64' => ['The file could not be processed.'],
                ]);
            }

            return $this->ok(
                $uploads->complete($user, $data['kind'], $data['fileName'], $contents),
                'Upload finished'
            );
        }

        return $this->ok($uploads->finish($user, $data['uploadId']), 'Upload finished');
    }

    public function store(QuotationSubmitRequest $request, SupplyChainService $service)
    {
        $quote = $service->submitSupplierQuotation($request->validated(), $request->user());

        return $this->created(
            (new QuotationResource($quote->loadMissing(['procurementRequest.catalogItem', 'supplier'])))->resolve(),
            'Quotation submitted'
        );
    }

    public function update(QuotationUpdateRequest $request, Quotation $quotation, SupplyChainService $service)
    {
        $quote = $service->updateSupplierQuotation($quotation, $request->validated(), $request->user());

        return $this->ok(
            (new QuotationResource($quote->loadMissing(['procurementRequest.catalogItem', 'supplier'])))->resolve(),
            'Quotation updated'
        );
    }

    public function select(Request $request, Quotation $quotation, SupplyChainService $service)
    {
        if (! $request->user()->canManageAll()) {
            return $this->fail('Only supply chain staff can select a supplier.', 403);
        }

        $pr = $quotation->procurementRequest ?: ProcurementRequest::query()->findOrFail($quotation->procurement_request_id);
        $po = $service->selectSupplierAndCreatePO($pr, $quotation);

        return $this->ok(new PurchaseOrderResource($po), 'Supplier selected and purchase order created');
    }
}
