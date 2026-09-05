<?php

namespace Tests\Feature;

use Tests\TestCase;

class VendorLoginPageTest extends TestCase
{
    public function test_primo_mascot_is_published_for_the_vendor_login_background(): void
    {
        $path = public_path('images/primo-mabuhay.png');

        $this->assertFileExists($path);
        $this->assertSame('image/png', mime_content_type($path));
    }

    public function test_vendor_login_uses_right_panel_and_princeton_orange_header(): void
    {
        $login = file_get_contents(resource_path('js/pages/Login.jsx'));
        $css = file_get_contents(resource_path('js/styles/ui.css'));
        $this->assertMatchesRegularExpression(
            "/view === 'register'[\\s\\S]{0,500}login-screen-vendor[\\s\\S]{0,400}login-hero-brand[\\s\\S]{0,300}VendorRegister/",
            $login
        );
        $this->assertMatchesRegularExpression(
            '/login-screen-vendor[\s\S]{0,400}login-panel[\s\S]{0,80}\{card\}/',
            $login
        );
        $this->assertStringContainsString("url('/images/primo-mabuhay.png')", $css);
        $this->assertStringContainsString('.login-screen.login-screen-vendor', $css);
        $this->assertMatchesRegularExpression(
            '/\.login-screen\.login-screen-vendor\s*\{[^}]*var\(--bg-main\)/',
            $css
        );
        $this->assertMatchesRegularExpression(
            '/\.login-screen-vendor \.login-hero\s*\{[^}]*var\(--bg-main\)/',
            $css
        );
        $this->assertDoesNotMatchRegularExpression(
            '/\.login-screen(?:-vendor)?[^{]*\{[^}]*#000000/',
            $css
        );
        $this->assertMatchesRegularExpression(
            '/\.login-screen-vendor \.login-hero-brand \.brand-wordmark\s*\{[^}]*var\(--primary-accent\)[^}]*text-shadow:\s*none/',
            $css
        );
        $this->assertMatchesRegularExpression(
            '/\.login-screen-vendor \.login-hero-brand \.brand-wordmark\s*\{[^}]*font-size:\s*2\./',
            $css
        );
    }
}
