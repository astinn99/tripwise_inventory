<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DocumentStoreRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Services\SupplyChainService;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index()
    {
        $documents = Document::query()
            ->with(['inventoryItem', 'purchaseOrder', 'supplierAccount'])
            ->orderByDesc('id')
            ->get();

        return $this->ok(DocumentResource::collection($documents));
    }

    public function store(DocumentStoreRequest $request, SupplyChainService $service)
    {
        $doc = $service->archiveDocument($request->validated(), $request->file('file'));

        return $this->created(new DocumentResource($doc), 'Document archived');
    }

    public function download(Document $document): StreamedResponse
    {
        if (! $document->file_path || ! Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found.');
        }

        $name = $document->original_filename ?: basename($document->file_path);

        return Storage::disk('public')->download($document->file_path, $name);
    }
}
