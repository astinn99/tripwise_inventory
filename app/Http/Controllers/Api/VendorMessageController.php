<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VendorMessageReadRequest;
use App\Http\Requests\VendorMessageRequest;
use App\Http\Resources\VendorMessageResource;
use App\Models\Supplier;
use App\Models\User;
use App\Models\VendorMessage;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VendorMessageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isSupplier()) {
            $supplierId = (int) $user->supplier_id;
            if ($supplierId < 1) {
                return $this->fail('Vendor account is not linked to a supplier.', 403);
            }

            $requested = $request->query('supplier');
            if (is_string($requested) && $requested !== '') {
                $own = Supplier::query()->whereKey($supplierId)->value('code');
                if ($requested !== $own) {
                    return $this->fail('You can only read your own conversation.', 403);
                }
            }

            return $this->ok($this->threadPayload($request, $supplierId));
        }

        $code = $request->query('supplier');
        if (is_string($code) && $code !== '') {
            $supplier = Supplier::query()->where('code', $code)->first();
            if (! $supplier) {
                return $this->fail('Supplier not found.', 404);
            }

            return $this->ok($this->threadPayload($request, (int) $supplier->id));
        }

        return $this->ok($this->inboxPayload());
    }

    public function store(VendorMessageRequest $request, NotificationService $notifications)
    {
        $user = $request->user();
        $body = (string) $request->validated('body');

        if ($user->isSupplier()) {
            $supplierId = (int) $user->supplier_id;
            if ($supplierId < 1) {
                return $this->fail('Vendor account is not linked to a supplier.', 403);
            }
        } else {
            $supplier = Supplier::query()->where('code', $request->validated('supplier'))->firstOrFail();
            $supplierId = (int) $supplier->id;
        }

        $message = VendorMessage::query()->create([
            'supplier_id' => $supplierId,
            'user_id' => $user->id,
            'body' => $body,
            'is_read' => false,
        ])->load('user');

        $preview = Str::limit($body, 180, '');

        if ($user->isSupplier()) {
            $user->loadMissing('supplier');
            $company = $user->supplier?->company_name ?: 'A vendor';
            $notifications->create(
                'New vendor message',
                $company.': '.$preview,
                'info',
                'info'
            );
        } else {
            $vendorIds = User::query()->where('supplier_id', $supplierId)->pluck('id')->all();
            if ($vendorIds !== []) {
                $notifications->createMany(array_map(fn (int $userId) => [
                    'title' => 'New message from TripWise',
                    'message' => $preview,
                    'type' => 'info',
                    'severity' => 'info',
                    'user_id' => $userId,
                ], $vendorIds));
            }
        }

        return $this->created(new VendorMessageResource($message), 'Message sent');
    }

    public function markRead(VendorMessageReadRequest $request)
    {
        $user = $request->user();

        if ($user->isSupplier()) {
            $supplierId = (int) $user->supplier_id;
            if ($supplierId < 1) {
                return $this->fail('Vendor account is not linked to a supplier.', 403);
            }
            $this->markOtherSideRead($supplierId, vendorSide: true);
        } else {
            $supplier = Supplier::query()->where('code', $request->validated('supplier'))->firstOrFail();
            $this->markOtherSideRead((int) $supplier->id, vendorSide: false);
        }

        return $this->ok([], 'Conversation marked read');
    }

    /**
     * @return array{unreadCount: int, messages: list<array<string, mixed>>}
     */
    private function threadPayload(Request $request, int $supplierId): array
    {
        $messages = VendorMessage::query()
            ->with('user')
            ->where('supplier_id', $supplierId)
            ->orderBy('id')
            ->get();

        return [
            'unreadCount' => $this->unreadCount($supplierId, $request->user()->isSupplier()),
            'messages' => VendorMessageResource::collection($messages)->resolve($request),
        ];
    }

    /**
     * @return list<array{supplierId: string, companyName: string, lastBody: string, lastAt: string|null, unreadCount: int}>
     */
    private function inboxPayload(): array
    {
        $lastIds = VendorMessage::query()
            ->selectRaw('MAX(id) as id')
            ->groupBy('supplier_id')
            ->pluck('id');

        if ($lastIds->isEmpty()) {
            return [];
        }

        $latest = VendorMessage::query()
            ->with('supplier')
            ->whereIn('id', $lastIds)
            ->orderByDesc('id')
            ->get();

        $unread = VendorMessage::query()
            ->whereIn('supplier_id', $latest->pluck('supplier_id'))
            ->where('is_read', false)
            ->whereHas('user', fn ($query) => $query->where('role', User::ROLE_SUPPLIER))
            ->selectRaw('supplier_id, COUNT(*) as unread_count')
            ->groupBy('supplier_id')
            ->pluck('unread_count', 'supplier_id');

        return $latest->map(fn (VendorMessage $message) => [
            'supplierId' => $message->supplier?->code,
            'companyName' => $message->supplier?->company_name,
            'lastBody' => $message->body,
            'lastAt' => optional($message->created_at)?->format('Y-m-d H:i'),
            'unreadCount' => (int) ($unread[$message->supplier_id] ?? 0),
        ])->values()->all();
    }

    private function unreadCount(int $supplierId, bool $forVendor): int
    {
        $query = VendorMessage::query()
            ->where('supplier_id', $supplierId)
            ->where('is_read', false);

        if ($forVendor) {
            $query->where(function ($inner) use ($supplierId) {
                $inner->whereNull('user_id')
                    ->orWhereDoesntHave('user', fn ($user) => $user->where('supplier_id', $supplierId));
            });
        } else {
            $query->whereHas('user', fn ($user) => $user->where('supplier_id', $supplierId));
        }

        return $query->count();
    }

    private function markOtherSideRead(int $supplierId, bool $vendorSide): void
    {
        $query = VendorMessage::query()->where('supplier_id', $supplierId);

        if ($vendorSide) {
            $query->where(function ($inner) use ($supplierId) {
                $inner->whereNull('user_id')
                    ->orWhereDoesntHave('user', fn ($user) => $user->where('supplier_id', $supplierId));
            });
        } else {
            $query->whereHas('user', fn ($user) => $user->where('supplier_id', $supplierId));
        }

        $query->update(['is_read' => true]);
    }
}
