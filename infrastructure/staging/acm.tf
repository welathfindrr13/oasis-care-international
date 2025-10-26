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

# DNS validation records for API certificate
resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# DNS validation records for Web certificate
resource "aws_route53_record" "web_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Certificate validation - waits for DNS validation to complete
resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }
}

resource "aws_acm_certificate_validation" "web" {
  certificate_arn         = aws_acm_certificate.web.arn
  validation_record_fqdns = [for record in aws_route53_record.web_cert_validation : record.fqdn]

  timeouts {
    create = "10m"
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
