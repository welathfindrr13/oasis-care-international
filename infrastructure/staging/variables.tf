variable "project" { default = "oasis-care" }
variable "environment" { default = "staging" }
variable "aws_region" { default = "eu-west-2" }

# Domain Configuration
variable "api_domain" { 
  description = "API domain name"
  type        = string
  default     = "api.oasis-care.com" 
}
variable "web_domain" { 
  description = "Web app domain name"
  type        = string
  default     = "app.oasis-care.com" 
}

# Route53 Configuration
variable "route53_zone_id" { 
  description = "Route53 hosted zone ID for oasis-care.com"
  type        = string
}

# ACM Certificate Configuration
variable "app_cert_arn" { 
  description = "ACM certificate ARN for web app domain"
  type        = string
}
variable "api_cert_arn" { 
  description = "ACM certificate ARN for API domain"
  type        = string
}

# KMS Configuration
variable "kms_key_id" { 
  description = "KMS key ID for encryption"
  type        = string
  default     = "8995c5be-616f-4680-953e-8ed3b7252689"
}

# Monitoring Configuration
variable "sns_topic_arn" { 
  description = "SNS topic ARN for alerts"
  type        = string
  default     = "arn:aws:sns:eu-west-2:721689331449:oasis-staging-alerts"
}

# Network Configuration
variable "vpc_cidr" { default = "10.1.0.0/16" }
variable "public_subnet_cidrs" { default = ["10.1.1.0/24", "10.1.2.0/24"] }
variable "private_subnet_cidrs" { default = ["10.1.10.0/24", "10.1.11.0/24"] }

# Database Configuration
variable "db_username" { default = "oasis" }
variable "db_instance_class" { default = "db.t3.micro" }

# Application Configuration
variable "frontend_url" { 
  description = "Frontend URL for CORS configuration"
  type        = string
  default     = "https://app.oasis-care.com,http://localhost:3000" 
}
variable "ai_summary_enabled" {
  default     = false
  description = "Enable AI summary feature in staging environment"
  type        = bool
}

variable "default_tags" {
  default = {
    Environment = "staging"
    Project     = "oasis-care"
    ManagedBy   = "terraform"
    Owner       = "devops-team"
    CostCenter  = "engineering"
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}"
}
