<?php

/**
 * JWT Authentication Middleware for elFinder
 * 驗證Django Simple JWT token並返回用戶信息
 */

class JWTAuth {
    private $secret_key;
    private $algorithm = 'HS256';

    public function __construct($secret_key) {
        $this->secret_key = $secret_key;
    }

    /**
     * 從HTTP請求中提取JWT token
     */
    public function extractToken() {
        $headers = $this->getAuthorizationHeader();

        if (empty($headers)) {
            return null;
        }

        // 支持 "Bearer TOKEN" 格式
        if (preg_match('/Bearer\s+(.*)$/i', $headers, $matches)) {
            return $matches[1];
        }

        return $headers;
    }

    /**
     * 獲取Authorization header
     */
    private function getAuthorizationHeader() {
        $headers = null;

        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER['Authorization']);
        } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            $requestHeaders = array_combine(
                array_map('ucwords', array_keys($requestHeaders)),
                array_values($requestHeaders)
            );

            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }

        return $headers;
    }

    /**
     * Base64 URL decode
     */
    private function base64UrlDecode($input) {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $input .= str_repeat('=', $padlen);
        }
        return base64_decode(strtr($input, '-_', '+/'));
    }

    /**
     * 驗證JWT token
     *
     * @param string $token JWT token
     * @return array|false 返回解碼的payload或false
     */
    public function verifyToken($token) {
        if (empty($token)) {
            return false;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        list($header64, $payload64, $signature64) = $parts;

        // 解碼header和payload
        $header = json_decode($this->base64UrlDecode($header64), true);
        $payload = json_decode($this->base64UrlDecode($payload64), true);

        if (!$header || !$payload) {
            return false;
        }

        // 驗證簽名
        $signature = $this->base64UrlDecode($signature64);
        $expectedSignature = hash_hmac(
            'sha256',
            $header64 . '.' . $payload64,
            $this->secret_key,
            true
        );

        if (!hash_equals($signature, $expectedSignature)) {
            error_log('JWT signature verification failed');
            return false;
        }

        // 檢查過期時間
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            error_log('JWT token expired');
            return false;
        }

        return $payload;
    }

    /**
     * 驗證請求並返回用戶信息
     *
     * @return array|null 返回用戶信息或null
     */
    public function authenticateRequest() {
        $token = $this->extractToken();

        if (!$token) {
            return null;
        }

        $payload = $this->verifyToken($token);

        if (!$payload) {
            return null;
        }

        // 返回用戶信息
        return array(
            'user_id' => isset($payload['user_id']) ? $payload['user_id'] : null,
            'email' => isset($payload['email']) ? $payload['email'] : null,
            'is_superuser' => isset($payload['is_superuser']) ? $payload['is_superuser'] : false,
            'is_staff' => isset($payload['is_staff']) ? $payload['is_staff'] : false,
        );
    }

    /**
     * 檢查用戶是否已認證
     */
    public function isAuthenticated() {
        return $this->authenticateRequest() !== null;
    }

    /**
     * 發送401未授權響應
     */
    public function sendUnauthorizedResponse($message = 'Unauthorized') {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(array(
            'error' => $message,
            'code' => 401
        ));
        exit();
    }
}
