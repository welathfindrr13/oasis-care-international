# Route53 hosted zone data source
data "aws_route53_zone" "main" {
  zone_id      = var.route53_zone_id
  private_zone = false
}

# DNS A records pointing to the Application Load Balancer
resource "aws_route53_record" "api" {
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

resource "aws_route53_record" "web" {
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

# Optional AAAA records for IPv6 support
resource "aws_route53_record" "api_ipv6" {
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "AAAA"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}

resource "aws_route53_record" "web_ipv6" {
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "AAAA"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_lb.main]
}
