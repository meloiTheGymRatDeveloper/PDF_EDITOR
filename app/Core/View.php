<?php
namespace App\Core;

class View
{
    public static function render(string $template, array $data = []): void
    {
        $file = __DIR__ . "/../Views/{$template}.php";

        if (!file_exists($file)) {
            throw new \RuntimeException("View not found: {$template}");
        }

        extract($data, EXTR_SKIP);
        include $file;
    }
}
