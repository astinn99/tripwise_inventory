<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckDocumentExpiry extends Command
{
    protected $signature = 'documents:check-expiry';

    protected $description = 'Notify supply staff when DTRS warranties, insurance, and contracts are nearing expiry.';

    public function handle(NotificationService $notifications): int
    {
        $alerted = 0;

        Document::query()
            ->whereNotNull('expiration_date')
            ->orderBy('expiration_date')
            ->each(function (Document $document) use ($notifications, &$alerted): void {
                $window = $document->alertWindow();
                if ($window === null || $document->last_alert_window === $window) {
                    return;
                }

                [$title, $severity] = $this->alertCopy($document, $window);
                $notifications->create($title, $this->alertMessage($document, $window), 'document', $severity);

                $document->forceFill([
                    'last_alerted_at' => now(),
                    'last_alert_window' => $window,
                ])->save();

                $alerted++;
            });

        $this->info("Sent {$alerted} document expiry notification(s).");

        return self::SUCCESS;
    }

    /** @return array{0: string, 1: string} */
    private function alertCopy(Document $document, string $window): array
    {
        return match ($window) {
            'expired' => ['Document Expired', 'danger'],
            '0' => ['Document Expires Today', 'danger'],
            '7' => ['Document Expiring This Week', 'warning'],
            '30' => ['Document Expiring Soon', 'warning'],
            '60' => ['Document Renewal Window', 'info'],
            default => ['Document Renewal Reminder', 'info'],
        };
    }

    private function alertMessage(Document $document, string $window): string
    {
        $when = $document->expiration_date?->toDateString() ?? 'unknown';

        return match ($window) {
            'expired' => "{$document->type} \"{$document->title}\" ({$document->document_number}) expired on {$when}.",
            '0' => "{$document->type} \"{$document->title}\" ({$document->document_number}) expires today.",
            default => "{$document->type} \"{$document->title}\" ({$document->document_number}) expires on {$when}.",
        };
    }
}
