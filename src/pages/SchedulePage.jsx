import TeamSchedule from "../components/calendar/TeamSchedule";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { prettyTimeZone } from "../utils/format";
import { isOwner } from "../utils/roles";

// The whole crew's schedule, for the owner and employees with client access.
export default function SchedulePage() {
  const { user } = useAuth();
  const owner = isOwner(user);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team schedule"
        description={`Who works which job. Times are ${prettyTimeZone(user.timezone)} time.`}
        actions={
          owner && (
            <ButtonLink to="/jobs?new=1">
              <PlusIcon />
              New job
            </ButtonLink>
          )
        }
      />
      <Card bodyClassName="p-3 sm:p-5">
        <TeamSchedule mode={owner ? "owner" : "admin"} variant="page" timezone={user.timezone} selfId={user.id} />
      </Card>
    </div>
  );
}
