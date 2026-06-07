<?php
namespace App\Controllers;

use App\Core\Controller;

class EditorController extends Controller
{
    private const VALID_TOOLS = [
        'annotate', 'merge', 'split', 'compress', 'convert', 'sign',
        'add-text', 'page-manager', 'watermark', 'header-footer', 'protect',
    ];

    public function index(string $tool): void
    {
        if (!in_array($tool, self::VALID_TOOLS, true)) {
            $this->abort(404);
        }

        $toolMeta = [
            'annotate'      => ['icon' => '✏️',  'label' => 'Annotate'],
            'merge'         => ['icon' => '🔗',  'label' => 'Merge'],
            'split'         => ['icon' => '✂️',  'label' => 'Split'],
            'compress'      => ['icon' => '🗜️', 'label' => 'Compress'],
            'convert'       => ['icon' => '🔄',  'label' => 'Convert to JPG'],
            'sign'          => ['icon' => '📝',  'label' => 'Fill & Sign'],
            'add-text'      => ['icon' => '🖊️',  'label' => 'Add Text'],
            'page-manager'  => ['icon' => '📑',  'label' => 'Page Manager'],
            'watermark'     => ['icon' => '🌊',  'label' => 'Watermark'],
            'header-footer' => ['icon' => '📋',  'label' => 'Header & Footer'],
            'protect'       => ['icon' => '🔐',  'label' => 'Protect PDF'],
        ];

        $this->render('editor/index', [
            'title' => 'PDF_EDITOR — ' . $toolMeta[$tool]['label'],
            'tool'  => $tool,
            'meta'  => $toolMeta[$tool],
        ]);
    }
}
