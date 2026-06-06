<?php
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Models\FileModel;
use App\Models\PaymentModel;

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

if ($type !== 'payment.paid') {
    http_response_code(200);
    echo json_encode(['status' => 'ignored']);
    exit;
}

$refNumber = $event['data']['attributes']['data']['attributes']['reference_number'] ?? '';
if (!$refNumber) {
    http_response_code(422);
    echo json_encode(['error' => 'No reference number']);
    exit;
}

$fileModel = FileModel::fromEnv();
$fileModel->updateMeta($refNumber, ['status' => 'paid']);

http_response_code(200);
echo json_encode(['status' => 'ok']);
