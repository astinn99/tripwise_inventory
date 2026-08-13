<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DocumentStoreRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Services\NotificationService;
use App\Support\DocumentCode;

class DocumentController extends Controller
{
    public function index()
    {
        return $this->ok(DocumentResource::collection(Document::query()->orderByDesc('id')->get()));
    }

    public function store(DocumentStoreRequest $request, NotificationService $notifications)
    {
        $doc = Document::query()->create([
            'document_number' => DocumentCode::next('documents', 'document_number', 'DOC'),
            'title' => $request->validated('title'),
            'type' => $request->validated('type'),
            'reference_number' => $request->validated('referenceNumber'),
            'supplier' => $request->validated('supplier'),
            'issue_date' => $request->validated('issueDate') ?: now()->toDateString(),
            'expiration_date' => $request->validated('expirationDate'),
            'status' => $request->validated('status') ?: 'Active',
            'category' => $request->validated('category'),
            'file_size' => $request->validated('fileSize') ?: '1.5 MB',
        ]);

        $notifications->create('Document Archived', "Document \"{$doc->title}\" uploaded into DTRS.", 'document', 'info');

        return $this->created(new DocumentResource($doc), 'Document archived');
    }
}
