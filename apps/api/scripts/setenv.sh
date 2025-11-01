#!/bin/bash
# Load environment variables from .env.test file

set -a
source "$(dirname "$0")/../.env.test"
set +a
