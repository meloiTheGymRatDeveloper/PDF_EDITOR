<?php
namespace App\Core;

class Controller
{
    protected function render(string $template, array $data = []): void
    {
        View::render($template, $data);
    }

    protected function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }

    protected function redirect(string $url, int $status = 302): void
    {
        http_response_code($status);
        header("Location: {$url}");
        exit;
    }

    protected function abort(int $code): void
    {
        http_response_code($code);
        $view = __DIR__ . "/../Views/errors/{$code}.php";
        if (file_exists($view)) {
            include $view;
        } else {
            echo "<h1>Error {$code}</h1>";
        }
        exit;
    }
}
