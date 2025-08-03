variable "project"          { default = "oasis-care" }
variable "environment"      { default = "staging" }
variable "aws_region"       { default = "eu-west-2" }
variable "domain_name"      { default = "staging-api.oasis-care.com" }
variable "vpc_cidr"         { default = "10.1.0.0/16" }
variable "public_subnet_cidrs"  { default = ["10.1.1.0/24", "10.1.2.0/24"] }
variable "private_subnet_cidrs" { default = ["10.1.10.0/24", "10.1.11.0/24"] }
variable "db_username"      { default = "oasis_app" }
variable "db_instance_class" { default = "db.t3.micro" }
variable "frontend_url"     { default = "https://staging.oasis-care.com,http://localhost:3000" }

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
