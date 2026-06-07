<?php
namespace App\Models;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;

class FileModel
{
    private const BLOB_API = 'https://blob.vercel-storage.com';

    public function __construct(
        private string $token,
        private Client $http
    ) {}

    public static function fromEnv(): self
    {
        return new self(
            $_ENV['BLOB_READ_WRITE_TOKEN'],
            new Client()
        );
    }

    private function curlPut(string $url, string $body, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'PUT',
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [$response ?: '', $httpCode];
    }

    public function upload(string $uuid, string $bytes, string $mimeType = 'application/pdf'): string
    {
        $ext      = ($mimeType === 'application/zip') ? 'zip' : 'pdf';
        $filename = "pending_{$uuid}.{$ext}";

        [$body, $code] = $this->curlPut(self::BLOB_API . '/' . $filename, $bytes, [
            "Authorization: Bearer {$this->token}",
            "Content-Type: {$mimeType}",
            "x-content-type: {$mimeType}",
            "x-access: private",
        ]);

        if ($code >= 400) {
            throw new \RuntimeException("Blob upload failed ({$code}): {$body}");
        }

        $data    = json_decode($body, true);
        $blobUrl = $data['url'];

        $meta = [
            'status'     => 'pending',
            'expires_at' => time() + 3600,
            'blob_url'   => $blobUrl,
            'mime'       => $mimeType,
            'ext'        => $ext,
        ];

        [$metaBody, $metaCode] = $this->curlPut(self::BLOB_API . "/meta_{$uuid}.json", json_encode($meta), [
            "Authorization: Bearer {$this->token}",
            "Content-Type: application/json",
            "x-content-type: application/json",
            "x-access: private",
        ]);

        if ($metaCode >= 400) {
            throw new \RuntimeException("Meta upload failed ({$metaCode}): {$metaBody}");
        }

        return $blobUrl;
    }

    public function getMeta(string $uuid): ?array
    {
        try {
            $res = $this->http->get(self::BLOB_API . "/meta_{$uuid}.json", [
                'headers' => ['Authorization' => "Bearer {$this->token}"],
            ]);
            return json_decode((string) $res->getBody(), true);
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 404) return null;
            throw $e;
        }
    }

    public function updateMeta(string $uuid, array $changes): void
    {
        $meta = $this->getMeta($uuid) ?? [];
        $meta = array_merge($meta, $changes);

        [$body, $code] = $this->curlPut(self::BLOB_API . "/meta_{$uuid}.json", json_encode($meta), [
            "Authorization: Bearer {$this->token}",
            "Content-Type: application/json",
            "x-content-type: application/json",
            "x-access: private",
        ]);

        if ($code >= 400) {
            throw new \RuntimeException("Meta update failed ({$code}): {$body}");
        }
    }

    public function downloadBytes(string $blobUrl): string
    {
        $res = $this->http->get($blobUrl, [
            'headers' => ['Authorization' => "Bearer {$this->token}"],
        ]);
        return (string) $res->getBody();
    }

    public function delete(string $uuid): void
    {
        $meta = $this->getMeta($uuid);
        $urls = ["https://blob.vercel-storage.com/meta_{$uuid}.json"];
        if ($meta && isset($meta['blob_url'])) {
            $urls[] = $meta['blob_url'];
        }

        $this->http->delete(self::BLOB_API, [
            'headers' => [
                'Authorization' => "Bearer {$this->token}",
                'Content-Type'  => 'application/json',
            ],
            'json' => ['urls' => $urls],
        ]);
    }

    public function listExpiredUuids(): array
    {
        $res  = $this->http->get(self::BLOB_API, [
            'headers' => ['Authorization' => "Bearer {$this->token}"],
            'query'   => ['prefix' => 'meta_'],
        ]);
        $data  = json_decode((string) $res->getBody(), true);
        $now   = time();
        $uuids = [];

        foreach ($data['blobs'] ?? [] as $blob) {
            preg_match('/meta_([^.]+)\.json$/', $blob['pathname'], $m);
            if (!$m) continue;
            $uuid = $m[1];
            $meta = $this->getMeta($uuid);
            if ($meta && ($meta['expires_at'] ?? 0) < $now) {
                $uuids[] = $uuid;
            }
        }

        return $uuids;
    }
}
