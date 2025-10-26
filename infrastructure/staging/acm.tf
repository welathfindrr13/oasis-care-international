# ACM Certificate for API domain (api.oasis-care.co)
resource "aws_acm_certificate" "api" {
  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-api-cert"
  })
}

# ACM Certificate for Web domain (app.oasis-care.co)
resource "aws_acm_certificate" "web" {
  domain_name       = var.web_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-web-cert"
  })
}

# Certificate validation - uses email validation instead of DNS
# This avoids the for_each timing issue with domain_validation_options
resource "aws_acm_certificate_validation" "api" {
  certificate_arn = aws_acm_certificate.api.arn

  timeouts {
    create = "30m"
  }
}

resource "aws_acm_certificate_validation" "web" {
  certificate_arn = aws_acm_certificate.web.arn

  timeouts {
    create = "30m"
  }
}

# Output certificate ARNs for reference
output "api_certificate_arn" {
  description = "ARN of the validated API certificate"
  value       = aws_acm_certificate_validation.api.certificate_arn
}

output "web_certificate_arn" {
  description = "ARN of the validated Web certificate"
  value       = aws_acm_certificate_validation.web.certificate_arn
}
