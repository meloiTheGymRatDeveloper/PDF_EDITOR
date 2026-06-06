<?php
require_once __DIR__ . '/vendor/autoload.php';

if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

use App\Core\Router;
use App\Controllers\HomeController;
use App\Controllers\EditorController;
use App\Controllers\PaymentController;
use App\Controllers\DownloadController;

$router = new Router();

$router->get('/',                    [HomeController::class,    'index']);
$router->get('/editor/{tool}',       [EditorController::class,  'index']);
$router->post('/payment/prepare',    [PaymentController::class, 'prepare']);
$router->get('/payment/success',     [PaymentController::class, 'success']);
$router->get('/payment/failed',      [PaymentController::class, 'failed']);
$router->get('/download',            [DownloadController::class,'index']);

$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI']
);
