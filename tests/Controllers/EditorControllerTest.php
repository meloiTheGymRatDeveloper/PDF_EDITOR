<?php
namespace Tests\Controllers;

use App\Controllers\EditorController;
use PHPUnit\Framework\TestCase;

class EditorControllerTest extends TestCase
{
    private function getValidTools(): array
    {
        $ref = new \ReflectionClass(EditorController::class);
        return $ref->getConstants()['VALID_TOOLS'];
    }

    public function test_new_tool_slugs_are_accepted(): void
    {
        $tools = $this->getValidTools();
        foreach (['add-text', 'page-manager', 'watermark', 'header-footer', 'protect'] as $slug) {
            $this->assertContains($slug, $tools, "Expected '$slug' in VALID_TOOLS");
        }
    }

    public function test_existing_tool_slugs_still_accepted(): void
    {
        $tools = $this->getValidTools();
        foreach (['annotate', 'merge', 'split', 'compress', 'convert', 'sign'] as $slug) {
            $this->assertContains($slug, $tools, "Expected '$slug' still in VALID_TOOLS");
        }
    }
}
