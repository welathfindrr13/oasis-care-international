terraform {
  required_version = ">= 1.5"
  required_providers {
    aws    = { source = "hashicorp/aws",    version = ">= 5.0" }
    random = { source = "hashicorp/random", version = ">= 3.6" }
  }
  # Temporarily disabled remote backend for testing
  # backend "s3" {
  #   bucket         = "oasis-terraform-state-eu-west-2"
  #   key            = "staging/terraform.tfstate"
  #   region         = "eu-west-2"
  #   encrypt        = true
  #   dynamodb_table = "oasis-terraform-locks"
  # }
}
