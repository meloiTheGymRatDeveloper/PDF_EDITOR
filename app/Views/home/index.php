<?php
ob_start();
$tools = [
  ['icon' => '✏️',  'label' => 'Annotate',   'slug' => 'annotate',  'desc' => 'Add text, highlights & drawings'],
  ['icon' => '🔗',  'label' => 'Merge',       'slug' => 'merge',     'desc' => 'Combine multiple PDFs into one'],
  ['icon' => '✂️',  'label' => 'Split',       'slug' => 'split',     'desc' => 'Extract pages or ranges'],
  ['icon' => '🗜️', 'label' => 'Compress',    'slug' => 'compress',  'desc' => 'Reduce file size'],
  ['icon' => '🔄',  'label' => 'Convert',     'slug' => 'convert',   'desc' => 'Export pages as JPG images'],
  ['icon' => '📝',  'label' => 'Fill & Sign', 'slug' => 'sign',      'desc' => 'Fill forms and add signature'],
];
?>
<div class="hero">
  <h1 class="hero__title">Edit PDFs — Free</h1>
  <p class="hero__sub">All tools run in your browser. Pay ₱50 to download your file.</p>

  <div class="tool-grid">
    <?php foreach ($tools as $t): ?>
    <a href="/editor/<?= $t['slug'] ?>" class="tool-card glass">
      <div class="tool-card__icon"><?= $t['icon'] ?></div>
      <div class="tool-card__label"><?= $t['label'] ?></div>
    </a>
    <?php endforeach; ?>
  </div>
</div>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
