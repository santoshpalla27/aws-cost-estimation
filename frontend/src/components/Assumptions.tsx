interface AssumptionsProps {
    items: string[];
}

export function Assumptions({ items }: AssumptionsProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="assumptions">
            <h4>⚠️ Assumptions Made</h4>
            <ul>
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </div>
    );
}
