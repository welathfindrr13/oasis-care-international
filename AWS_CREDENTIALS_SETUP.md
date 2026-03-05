# How to Configure AWS Credentials

## Step 1: Get Your AWS Credentials

### Option A: If you're the AWS account owner
1. Go to AWS Console: https://console.aws.amazon.com
2. Click your name in top right → "Security credentials"
3. Scroll to "Access keys" section
4. Click "Create access key"
5. Choose "Command Line Interface (CLI)"
6. Click "Next" → "Create access key"
7. **IMPORTANT:** Copy both:
   - Access key ID (starts with AKIA...)
   - Secret access key (long random string - only shown once!)

### Option B: If someone else manages AWS
Ask your AWS administrator for:
- AWS Access Key ID
- AWS Secret Access Key
- Confirm the region is `eu-west-2`

## Step 2: Configure on Your Mac

Open Terminal and run:

```bash
export AWS_ACCESS_KEY_ID="AKIA..." # Replace with your actual key
export AWS_SECRET_ACCESS_KEY="..." # Replace with your actual secret
export AWS_DEFAULT_REGION="eu-west-2"
```

**Note:** These are temporary (only for current terminal session)

### To make permanent (optional):
```bash
# Edit your shell profile
nano ~/.zshrc  # or ~/.bash_profile

# Add these lines at the end:
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="eu-west-2"

# Save and reload
source ~/.zshrc
```

## Step 3: Test AWS Access

```bash
aws sts get-caller-identity
```

Should show:
```json
{
    "UserId": "...",
    "Account": "your-account-number",
    "Arn": "arn:aws:iam::..."
}
```

## Step 4: Tell Me You're Ready

Once you see the above output successfully, just say "AWS configured" and I can proceed with the deployment.

## Security Notes

⚠️ **IMPORTANT:**
- Never commit AWS credentials to Git
- Never share them publicly
- If compromised, delete the key immediately in AWS Console
- Use IAM user with minimal required permissions (not root account)

## What I'll Do Once Configured

1. Discover the correct private subnet IDs in your VPC
2. Fix the VPC configuration in terraform
3. Run the import script to bring existing resources into terraform state
4. Run terraform plan to verify changes
5. Run terraform apply to deploy
6. Guide you through ACM certificate validation

## Alternative: Use AWS SSO/Temporary Credentials

If your organization uses AWS SSO:
```bash
aws configure sso
# Follow the prompts
```

Then:
```bash
aws sso login
```

---

Ready to proceed once you run the test command successfully!
