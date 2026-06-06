<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\FileModel;
use App\Models\PaymentModel;
use Ramsey\Uuid\Uuid;

class PaymentController extends Controller
{
    public function prepare(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['error' => 'Method not allowed'], 405);
            return;
        }

        if (empty($_FILES['file'])) {
            $this->json(['error' => 'No file received'], 400);
            return;
        }

        $upload  = $_FILES['file'];
        $mime    = $_POST['mime'] ?? 'application/pdf';
        $bytes   = file_get_contents($upload['tmp_name']);
        $uuid    = Uuid::uuid4()->toString();

        $fileModel    = FileModel::fromEnv();
        $paymentModel = PaymentModel::fromEnv();

        $appUrl     = rtrim($_ENV['APP_URL'], '/');
        $successUrl = "{$appUrl}/payment/success?token={$uuid}";
        $failUrl    = "{$appUrl}/payment/failed?token={$uuid}";

        $fileModel->upload($uuid, $bytes, $mime);
        $checkoutUrl = $paymentModel->createLink($uuid, $successUrl, $failUrl);

        $this->json(['checkout_url' => $checkoutUrl, 'token' => $uuid]);
    }

    public function success(): void
    {
        $token     = $_GET['token'] ?? '';
        $fileModel = FileModel::fromEnv();
        $meta      = $fileModel->getMeta($token);

        if (!$meta || $meta['status'] !== 'paid') {
            $this->render('payment/failed', [
                'title'   => 'Payment Not Confirmed',
                'token'   => $token,
                'message' => 'Payment not yet confirmed. Please wait a moment and refresh.',
            ]);
            return;
        }

        $remaining = max(0, $meta['expires_at'] - time());
        $this->render('payment/success', [
            'title'     => 'Payment Successful — PDF_EDITOR',
            'token'     => htmlspecialchars($token),
            'remaining' => $remaining,
        ]);
    }

    public function failed(): void
    {
        $token = $_GET['token'] ?? '';
        $this->render('payment/failed', [
            'title'   => 'Payment Failed — PDF_EDITOR',
            'token'   => htmlspecialchars($token),
            'message' => 'Your payment was not completed.',
        ]);
    }
}
