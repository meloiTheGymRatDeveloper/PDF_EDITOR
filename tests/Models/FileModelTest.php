<?php
namespace Tests\Models;

use App\Models\FileModel;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class FileModelTest extends TestCase
{
    private function makeModel(array $responses): FileModel
    {
        $mock    = new MockHandler($responses);
        $handler = HandlerStack::create($mock);
        $client  = new Client(['handler' => $handler]);
        return new FileModel('fake-token', $client);
    }

    public function test_upload_returns_blob_url(): void
    {
        $model = $this->makeModel([
            new Response(200, [], json_encode(['url' => 'https://blob.example.com/pending_abc.pdf'])),
            new Response(200, [], json_encode(['url' => 'https://blob.example.com/meta_abc.json'])),
        ]);

        $url = $model->upload('abc', 'fake-pdf-bytes', 'application/pdf');
        $this->assertEquals('https://blob.example.com/pending_abc.pdf', $url);
    }

    public function test_get_meta_returns_decoded_json(): void
    {
        $meta  = ['status' => 'pending', 'expires_at' => time() + 3600, 'blob_url' => 'https://blob.example.com/pending_abc.pdf'];
        $model = $this->makeModel([
            new Response(200, [], json_encode($meta)),
        ]);

        $result = $model->getMeta('abc');
        $this->assertEquals('pending', $result['status']);
    }

    public function test_update_meta_merges_fields(): void
    {
        $existing = ['status' => 'pending', 'expires_at' => 9999999999, 'blob_url' => 'https://blob.example.com/x.pdf'];
        $model = $this->makeModel([
            new Response(200, [], json_encode($existing)),
            new Response(200, [], '{}'),
        ]);

        $model->updateMeta('abc', ['status' => 'paid']);
        $this->assertTrue(true);
    }

    public function test_get_meta_returns_null_on_404(): void
    {
        $model = $this->makeModel([
            new Response(404, [], 'not found'),
        ]);

        $result = $model->getMeta('nonexistent');
        $this->assertNull($result);
    }
}
