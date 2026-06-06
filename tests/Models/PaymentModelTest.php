<?php
namespace Tests\Models;

use App\Models\PaymentModel;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class PaymentModelTest extends TestCase
{
    private function makeModel(array $responses): PaymentModel
    {
        $mock    = new MockHandler($responses);
        $handler = HandlerStack::create($mock);
        $client  = new Client(['handler' => $handler]);
        return new PaymentModel('sk_test_key', 'whsk_test_secret', $client);
    }

    public function test_create_link_returns_checkout_url(): void
    {
        $model = $this->makeModel([
            new Response(200, [], json_encode([
                'data' => ['attributes' => ['checkout_url' => 'https://pm.link/abc']],
            ])),
        ]);

        $url = $model->createLink('uuid-123', 'https://app.example.com/payment/success?token=uuid-123', 'https://app.example.com/payment/failed?token=uuid-123');
        $this->assertEquals('https://pm.link/abc', $url);
    }

    public function test_verify_webhook_signature_valid(): void
    {
        $model   = new PaymentModel('sk_test_key', 'whsk_test_secret', new Client());
        $secret  = 'whsk_test_secret';
        $ts      = (string) time();
        $body    = '{"data":{"type":"payment"}}';
        $signed  = hash_hmac('sha256', "{$ts}.{$body}", $secret);
        $header  = "t={$ts},te={$signed},li={$signed}";

        $this->assertTrue($model->verifyWebhookSignature($body, $header));
    }

    public function test_verify_webhook_signature_invalid(): void
    {
        $model  = new PaymentModel('sk_test_key', 'whsk_test_secret', new Client());
        $header = 't=12345,te=badsig,li=badsig';
        $this->assertFalse($model->verifyWebhookSignature('{"data":{}}', $header));
    }
}
