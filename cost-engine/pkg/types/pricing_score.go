package types

// PricingScore represents the quality of a pricing match
type PricingScore struct {
	Score             float64            // 0.0 to 1.0
	MatchType         MatchType          // EXACT, FALLBACK, HEURISTIC
	MissingAttributes []string           // Attributes that didn't match
	MatchedAttributes []string           // Attributes that matched
	IsAmbiguous       bool               // True if multiple similar scores exist
	Explanation       string             // Human-readable match explanation
}

// PricingCandidate represents a potential pricing match with score
type PricingCandidate struct {
	Match PricingMatch
	Score PricingScore
}

// CalculateMatchScore computes quality score for a pricing match
func CalculateMatchScore(
	requested map[string]interface{},
	candidate map[string]interface{},
	usageTypeMatch bool,
	unitMatch bool,
) PricingScore {
	score := PricingScore{
		Score:             0.0,
		MatchedAttributes: []string{},
		MissingAttributes: []string{},
	}

	// Base score for usage type match
	if usageTypeMatch {
		score.Score += 1.0
		score.MatchedAttributes = append(score.MatchedAttributes, "usage_type")
	} else {
		score.Score -= 0.5
		score.MissingAttributes = append(score.MissingAttributes, "usage_type")
	}

	// Unit mismatch is critical
	if !unitMatch {
		score.Score -= 0.3
		score.MissingAttributes = append(score.MissingAttributes, "unit")
	} else {
		score.MatchedAttributes = append(score.MatchedAttributes, "unit")
	}

	// Check attribute matches
	matchedCount := 0
	totalAttributes := len(requested)
	
	for key, reqValue := range requested {
		if candValue, exists := candidate[key]; exists {
			if reqValue == candValue {
				matchedCount++
				score.MatchedAttributes = append(score.MatchedAttributes, key)
			} else {
				score.MissingAttributes = append(score.MissingAttributes, key)
				score.Score -= 0.2
			}
		} else {
			score.MissingAttributes = append(score.MissingAttributes, key)
			score.Score -= 0.2
		}
	}

	// Bonus for complete attribute match
	if matchedCount == totalAttributes && totalAttributes > 0 {
		score.Score += 0.5
	}

	// Determine match type based on score
	if score.Score >= 1.5 && len(score.MissingAttributes) == 0 {
		score.MatchType = MatchExact
	} else if score.Score >= 0.8 {
		score.MatchType = MatchFallback
	} else {
		score.MatchType = MatchHeuristic
	}

	// Normalize score to 0.0-1.0 range
	if score.Score > 1.0 {
		score.Score = 1.0
	} else if score.Score < 0.0 {
		score.Score = 0.0
	}

	return score
}

// DetectAmbiguity checks if multiple candidates have similar scores
func DetectAmbiguity(candidates []PricingCandidate, threshold float64) bool {
	if len(candidates) < 2 {
		return false
	}

	topScore := candidates[0].Score.Score
	for i := 1; i < len(candidates); i++ {
		diff := topScore - candidates[i].Score.Score
		if diff < 0 {
			diff = -diff
		}
		if diff <= threshold {
			return true
		}
	}
	return false
}
