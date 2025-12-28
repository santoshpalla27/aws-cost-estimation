import React from 'react';
import { USAGE_PROFILES, UsageProfile } from '@/engine/usage.engine';
import './UsageProfileSelector.css';

interface UsageProfileSelectorProps {
    selectedProfile: string | null;
    onSelectProfile: (profileId: string) => void;
}

const UsageProfileSelector: React.FC<UsageProfileSelectorProps> = ({
    selectedProfile,
    onSelectProfile
}) => {
    const profiles = Object.values(USAGE_PROFILES);

    return (
        <div className="usage-profile-selector">
            <div className="profile-header">
                <h4>Usage Profile</h4>
                <p className="profile-description">
                    Quick presets for common deployment scenarios
                </p>
            </div>

            <div className="profile-cards">
                {profiles.map((profile) => (
                    <button
                        key={profile.id}
                        className={`profile-card ${selectedProfile === profile.id ? 'active' : ''
                            }`}
                        onClick={() => onSelectProfile(profile.id)}
                        title={profile.description}
                    >
                        <div className="profile-icon">{profile.icon}</div>
                        <div className="profile-content">
                            <h5 className="profile-name">{profile.name}</h5>
                            <p className="profile-desc">{profile.description}</p>
                        </div>
                        {selectedProfile === profile.id && (
                            <div className="profile-check">✓</div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default UsageProfileSelector;
