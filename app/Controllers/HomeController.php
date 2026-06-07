<?php
namespace App\Controllers;

use App\Core\Controller;

class HomeController extends Controller
{
    public function index(): void
    {
        $tabs = [
            'edit' => [
                'label' => '✏️ Edit',
                'tools' => [
                    ['icon' => '🖊️',  'label' => 'Add Text',       'slug' => 'add-text',      'desc' => 'Place text anywhere on the PDF'],
                    ['icon' => '✏️',  'label' => 'Annotate',        'slug' => 'annotate',      'desc' => 'Highlights, drawings & sticky notes'],
                    ['icon' => '📝',  'label' => 'Fill & Sign',     'slug' => 'sign',          'desc' => 'Fill forms and add signature'],
                    ['icon' => '🌊',  'label' => 'Watermark',       'slug' => 'watermark',     'desc' => 'Add text or image watermark'],
                    ['icon' => '📋',  'label' => 'Header & Footer', 'slug' => 'header-footer', 'desc' => 'Headers, footers & page numbers'],
                ],
            ],
            'organize' => [
                'label' => '📄 Organize',
                'tools' => [
                    ['icon' => '📑',  'label' => 'Page Manager', 'slug' => 'page-manager', 'desc' => 'Add, delete, reorder & rotate pages'],
                    ['icon' => '🔗',  'label' => 'Merge',        'slug' => 'merge',        'desc' => 'Combine multiple PDFs into one'],
                    ['icon' => '✂️',  'label' => 'Split',        'slug' => 'split',        'desc' => 'Extract pages or ranges'],
                    ['icon' => '🗜️', 'label' => 'Compress',     'slug' => 'compress',     'desc' => 'Reduce file size'],
                ],
            ],
            'protect' => [
                'label' => '🔒 Protect',
                'tools' => [
                    ['icon' => '🔐', 'label' => 'Protect PDF', 'slug' => 'protect', 'desc' => 'Password protect & encrypt'],
                ],
            ],
            'convert' => [
                'label' => '🔄 Convert',
                'tools' => [
                    ['icon' => '🔄', 'label' => 'Convert', 'slug' => 'convert', 'desc' => 'Export pages as JPG images'],
                ],
            ],
        ];

        $this->render('home/index', [
            'title' => 'PDF_EDITOR — Free PDF Tools',
            'tabs'  => $tabs,
        ]);
    }
}
