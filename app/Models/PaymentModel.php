<?php
namespace App\Models;

use GuzzleHttp\Client;

class PaymentModel
{
    private const API = 'https://api.paymongo.com/v1';

    public function __construct(
        private string $secretKey,
        private string $webhookSecret,
        private Client $http
    ) {}

    public static function fromEnv(): self
    {
        return new self(
            $_ENV['PAYMONGO_SECRET_KEY'],
            $_ENV['PAYMONGO_WEBHOOK_SECRET'],
            new Client()
        );
    }

    public function createLink(string $uuid, string $successUrl, string $failUrl): string
    {
        $res = $this->http->post(self::API . '/checkout_sessions', [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($this->secretKey . ':'),
                'Content-Type'  => 'application/json',
            ],
            'json' => [
                'data' => [
                    'attributes' => [
                        'cancel_url'           => $failUrl,
                        'success_url'          => $successUrl,
                        'description'          => 'PDF_EDITOR download',
                        'reference_number'     => $uuid,
                        'line_items'           => [[
                            'currency' => 'PHP',
                            'amount'   => 5000,
                            'name'     => 'PDF Download',
                            'quantity' => 1,
                        ]],
                        'payment_method_types' => ['card', 'gcash', 'maya', 'qrph'],
                    ],
                ],
            ],
        ]);

        $data = json_decode((string) $res->getBody(), true);
        return $data['data']['attributes']['checkout_url'];
    }

    public function verifyWebhookSignature(string $rawBody, string $signatureHeader): bool
    {
        $parts = [];
        foreach (explode(',', $signatureHeader) as $part) {
            [$k, $v]    = explode('=', $part, 2);
            $parts[$k] = $v;
        }

        if (empty($parts['t'])) return false;

        $payload  = $parts['t'] . '.' . $rawBody;
        $expected = hash_hmac('sha256', $payload, $this->webhookSecret);

        $toCheck = $parts['te'] ?? $parts['li'] ?? '';
        return hash_equals($expected, $toCheck);
    }
}
