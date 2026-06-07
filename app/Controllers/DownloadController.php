<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\FileModel;

class DownloadController extends Controller
{
    public function __construct(private ?FileModel $fileModel = null)
    {
        $this->fileModel ??= FileModel::fromEnv();
    }

    public function isExpired(array $meta): bool
    {
        return ($meta['expires_at'] ?? 0) < time();
    }

    public function isPaid(array $meta): bool
    {
        return ($meta['status'] ?? '') === 'paid';
    }

    public function index(): void
    {
        $token = $_GET['token'] ?? '';

        if (!$token) {
            $this->abort(404);
        }

        $meta = $this->fileModel->getMeta($token);

        if ($meta === null) {
            $this->abort(404);
        }

        if ($this->isExpired($meta)) {
            http_response_code(410);
            include __DIR__ . '/../Views/errors/410.php';
            exit;
        }

        if (!$this->isPaid($meta)) {
            $this->abort(403);
        }

        $ext      = $meta['ext'] ?? 'pdf';
        $mime     = $meta['mime'] ?? 'application/pdf';
        $bytes    = $this->fileModel->downloadBytes($meta['blob_url']);

        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="output.' . $ext . '"');
        header('Content-Length: ' . strlen($bytes));
        echo $bytes;
        exit;
    }
}
