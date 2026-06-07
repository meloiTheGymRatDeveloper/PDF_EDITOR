<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Models\FileModel;
use App\Models\PaymentModel;

header('Content-Type: application/json');

try {
    $rawBody   = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';

    $paymentModel = PaymentModel::fromEnv();

    if (!$paymentModel->verifyWebhookSignature($rawBody, $sigHeader)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }

    $event = json_decode($rawBody, true);
    $type  = $event['data']['attributes']['type'] ?? '';

    $paidTypes = ['payment.paid', 'link.payment.paid', 'checkout_session.payment.paid'];
    if (!in_array($type, $paidTypes, true)) {
        http_response_code(200);
        echo json_encode(['status' => 'ignored', 'type' => $type]);
        exit;
    }

    $attrs     = $event['data']['attributes']['data']['attributes'] ?? [];
    $refNumber = $attrs['reference_number']
        ?? $event['data']['attributes']['data']['id']
        ?? '';

    if (!$refNumber) {
        http_response_code(422);
        echo json_encode(['error' => 'No reference number']);
        exit;
    }

    $fileModel = FileModel::fromEnv();
    $fileModel->updateMeta($refNumber, ['status' => 'paid']);

    http_response_code(200);
    echo json_encode(['status' => 'ok']);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
