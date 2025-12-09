#!/bin/bash
cd /home/kavia/workspace/code-generation/strategic-growth-platform-221604-221613/sge_backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

