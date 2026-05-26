// Package hmacguard is a small Caddy v2 HTTP handler that verifies an
// HMAC-SHA256 signature over the request body before passing the request on.
//
// It exists because the only off-the-shelf Caddy HMAC plugin
// (abiosoft/caddy-hmac) compares signatures via a non-constant-time Caddyfile
// matcher. This module does the comparison internally with crypto/hmac.Equal,
// which is constant-time, as required by the gateway spec.
//
// Caddyfile:
//
//	hmac_guard <secret> {
//	    max_body_bytes <n>   # optional, default 1 MiB
//	}
//
// The expected request header is `X-Hub-Signature-256: sha256=<hex>`. A missing
// or malformed header, or a signature mismatch, is rejected with 401.
package hmacguard

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

const (
	sigHeader           = "X-Hub-Signature-256"
	sigPrefix           = "sha256="
	defaultMaxBodyBytes = 1 << 20 // 1 MiB
)

func init() {
	caddy.RegisterModule(HMACGuard{})
	httpcaddyfile.RegisterHandlerDirective("hmac_guard", parseCaddyfile)
}

// HMACGuard verifies the HMAC-SHA256 of the request body against the
// X-Hub-Signature-256 header using a constant-time comparison.
type HMACGuard struct {
	// Secret is the shared HMAC key. In the Caddyfile it is typically supplied
	// via an environment placeholder, e.g. `hmac_guard {$HMAC_SECRET}`.
	Secret string `json:"secret,omitempty"`
	// MaxBodyBytes caps how much of the body is read for hashing. Default 1 MiB.
	MaxBodyBytes int64 `json:"max_body_bytes,omitempty"`
}

// CaddyModule returns the Caddy module information.
func (HMACGuard) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.hmac_guard",
		New: func() caddy.Module { return new(HMACGuard) },
	}
}

// Provision sets defaults.
func (h *HMACGuard) Provision(_ caddy.Context) error {
	if h.MaxBodyBytes <= 0 {
		h.MaxBodyBytes = defaultMaxBodyBytes
	}
	return nil
}

// Validate ensures the module is configured.
func (h *HMACGuard) Validate() error {
	if h.Secret == "" {
		return fmt.Errorf("hmac_guard: secret is required")
	}
	return nil
}

// ServeHTTP verifies the signature, then calls the next handler.
func (h HMACGuard) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	got := r.Header.Get(sigHeader)
	if !strings.HasPrefix(got, sigPrefix) {
		return caddyhttp.Error(http.StatusUnauthorized,
			fmt.Errorf("missing or malformed %s header", sigHeader))
	}
	provided, err := hex.DecodeString(strings.TrimPrefix(got, sigPrefix))
	if err != nil {
		return caddyhttp.Error(http.StatusUnauthorized,
			fmt.Errorf("invalid signature encoding"))
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, h.MaxBodyBytes))
	if err != nil {
		return caddyhttp.Error(http.StatusBadRequest, err)
	}
	_ = r.Body.Close()
	// Restore the body so the downstream reverse_proxy can read it.
	r.Body = io.NopCloser(bytes.NewReader(body))

	mac := hmac.New(sha256.New, []byte(h.Secret))
	mac.Write(body)
	expected := mac.Sum(nil)

	if !hmac.Equal(expected, provided) {
		return caddyhttp.Error(http.StatusUnauthorized,
			fmt.Errorf("signature mismatch"))
	}
	return next.ServeHTTP(w, r)
}

// UnmarshalCaddyfile parses: hmac_guard <secret> { max_body_bytes <n> }
func (h *HMACGuard) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	for d.Next() { // directive name
		if d.NextArg() {
			h.Secret = d.Val()
		}
		if d.NextArg() {
			return d.ArgErr()
		}
		for d.NextBlock(0) {
			switch d.Val() {
			case "max_body_bytes":
				if !d.NextArg() {
					return d.ArgErr()
				}
				n, err := strconv.ParseInt(d.Val(), 10, 64)
				if err != nil {
					return d.Errf("invalid max_body_bytes: %v", err)
				}
				h.MaxBodyBytes = n
			default:
				return d.Errf("unknown hmac_guard subdirective %q", d.Val())
			}
		}
	}
	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var hg HMACGuard
	if err := hg.UnmarshalCaddyfile(h.Dispenser); err != nil {
		return nil, err
	}
	return hg, nil
}

// Interface guards.
var (
	_ caddy.Provisioner           = (*HMACGuard)(nil)
	_ caddy.Validator             = (*HMACGuard)(nil)
	_ caddyhttp.MiddlewareHandler = (*HMACGuard)(nil)
	_ caddyfile.Unmarshaler       = (*HMACGuard)(nil)
)
