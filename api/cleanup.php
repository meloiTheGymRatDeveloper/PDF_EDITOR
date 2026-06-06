<?php
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Models\FileModel;

$cronSecret = $_ENV['CRON_SECRET'] ?? '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if ($cronSecret && $authHeader !== "Bearer {$cronSecret}") {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$fileModel = FileModel::fromEnv();
$expired   = $fileModel->listExpiredUuids();

foreach ($expired as $uuid) {
    $fileModel->delete($uuid);
}

http_response_code(200);
echo json_encode(['deleted' => count($expired), 'uuids' => $expired]);
