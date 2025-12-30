package handlers

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	// MaxZipSize is the maximum allowed ZIP file size (500MB)
	MaxZipSize = 500 * 1024 * 1024

	// MaxUnzippedSize is the maximum total unzipped size (1GB)
	MaxUnzippedSize = 1024 * 1024 * 1024
)

// UnzipFile safely unzips a file to a destination directory
func UnzipFile(zipPath, destDir string) error {
	// Open ZIP file
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open zip: %w", err)
	}
	defer reader.Close()

	var totalSize int64

	// Extract files
	for _, file := range reader.File {
		// Security: Prevent path traversal
		if err := validateZipPath(file.Name); err != nil {
			return err
		}

		// Track total unzipped size
		totalSize += int64(file.UncompressedSize64)
		if totalSize > MaxUnzippedSize {
			return fmt.Errorf("unzipped size exceeds limit of %d bytes", MaxUnzippedSize)
		}

		// Create file path
		filePath := filepath.Join(destDir, file.Name)

		// Create directories
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(filePath, os.ModePerm); err != nil {
				return fmt.Errorf("failed to create directory: %w", err)
			}
			continue
		}

		// Create parent directory
		if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
			return fmt.Errorf("failed to create parent directory: %w", err)
		}

		// Extract file
		if err := extractFile(file, filePath); err != nil {
			return err
		}
	}

	return nil
}

func extractFile(file *zip.File, destPath string) error {
	// Open file in ZIP
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open file in zip: %w", err)
	}
	defer src.Close()

	// Create destination file
	dest, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer dest.Close()

	// Copy contents
	if _, err := io.Copy(dest, src); err != nil {
		return fmt.Errorf("failed to extract file: %w", err)
	}

	return nil
}

// validateZipPath prevents path traversal attacks
func validateZipPath(path string) error {
	// Normalize path
	cleaned := filepath.Clean(path)

	// Check for path traversal
	if strings.Contains(cleaned, "..") {
		return fmt.Errorf("invalid path (path traversal detected): %s", path)
	}

	// Check for absolute paths
	if filepath.IsAbs(cleaned) {
		return fmt.Errorf("invalid path (absolute path not allowed): %s", path)
	}

	return nil
}

// HasTerraformFiles checks if a directory contains .tf files
func HasTerraformFiles(dir string) (bool, error) {
	found := false

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && filepath.Ext(path) == ".tf" {
			found = true
			return filepath.SkipDir // Stop walking once found
		}

		return nil
	})

	return found, err
}

// IsTerraformPlanJSON checks if a file is a Terraform plan JSON
func IsTerraformPlanJSON(filePath string) bool {
	// Check extension
	if filepath.Ext(filePath) != ".json" {
		return false
	}

	// Read first few bytes to check for plan structure
	file, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer file.Close()

	// Read first 1KB
	buf := make([]byte, 1024)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return false
	}

	content := string(buf[:n])

	// Check for Terraform plan JSON indicators
	return strings.Contains(content, "\"format_version\"") &&
		strings.Contains(content, "\"planned_values\"")
}
