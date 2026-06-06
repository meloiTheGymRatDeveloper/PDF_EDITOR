<?php
namespace Tests\Controllers;

use App\Controllers\DownloadController;
use App\Models\FileModel;
use PHPUnit\Framework\TestCase;

class DownloadControllerTest extends TestCase
{
    public function test_is_expired_returns_true_for_past_timestamp(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $meta = ['expires_at' => time() - 1];
        $this->assertTrue($controller->isExpired($meta));
    }

    public function test_is_expired_returns_false_for_future_timestamp(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $meta = ['expires_at' => time() + 3600];
        $this->assertFalse($controller->isExpired($meta));
    }

    public function test_is_paid_returns_true_for_paid_status(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $this->assertTrue($controller->isPaid(['status' => 'paid']));
    }

    public function test_is_paid_returns_false_for_pending_status(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $this->assertFalse($controller->isPaid(['status' => 'pending']));
    }
}
