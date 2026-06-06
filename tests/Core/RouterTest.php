<?php
namespace Tests\Core;

use App\Core\Router;
use PHPUnit\Framework\TestCase;

class RouterTest extends TestCase
{
    private Router $router;

    protected function setUp(): void
    {
        $this->router = new Router();
    }

    public function test_matches_static_get_route(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('GET', '/');
        $this->assertNotNull($match);
        $this->assertEquals(['HomeController', 'index'], $match['handler']);
        $this->assertEmpty($match['params']);
    }

    public function test_matches_dynamic_route_and_extracts_param(): void
    {
        $this->router->get('/editor/{tool}', ['EditorController', 'index']);
        $match = $this->router->match('GET', '/editor/annotate');
        $this->assertNotNull($match);
        $this->assertEquals('annotate', $match['params']['tool']);
    }

    public function test_returns_null_for_unmatched_route(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('GET', '/nonexistent');
        $this->assertNull($match);
    }

    public function test_does_not_match_wrong_method(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('POST', '/');
        $this->assertNull($match);
    }

    public function test_matches_post_route(): void
    {
        $this->router->post('/payment/prepare', ['PaymentController', 'prepare']);
        $match = $this->router->match('POST', '/payment/prepare');
        $this->assertNotNull($match);
    }

    public function test_strips_query_string_before_matching(): void
    {
        $this->router->get('/payment/success', ['PaymentController', 'success']);
        $match = $this->router->match('GET', '/payment/success?token=abc123');
        $this->assertNotNull($match);
    }
}
