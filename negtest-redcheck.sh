#!/usr/bin/env bash
# TEMPORARY negative-test fixture — proves branch protection blocks a red PR.
# This file is a CODE file (.sh) committed WITHOUT a CHANGELOG entry, so the
# "Changelog gates" required check fails on purpose. The PR is then attempted-
# merged to show GitHub rejects it, and closed (never merged). Safe to delete.
echo "negative-test: this PR must NOT be mergeable while Changelog gates is red"
