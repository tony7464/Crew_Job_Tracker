import ErrorMessage from "../components/ErrorMessage";
import JobList from "../components/JobList";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import { ButtonLink } from "../components/ui/Button";
import { CalendarIcon, PlusIcon } from "../components/ui/Icons";
import { PageHeader, SectionHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { usePaged } from "../hooks";
import { prettyTimeZone } from "../utils/format";

// The employee home page: jobs assigned to this employee, soonest first, then past jobs.
export default function MyJobsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <PageHeader
        title="My jobs"
        description={`Jobs assigned to you. Times are ${prettyTimeZone(user.timezone)} time.`}
        actions={
          <>
            <ButtonLink to="/calendar" variant="secondary">
              <CalendarIcon />
              Calendar
            </ButtonLink>
            <ButtonLink to="/calendar?addLunch=1">
              <PlusIcon />
              Add lunch
            </ButtonLink>
          </>
        }
      />
      <JobSection title="Upcoming" when="upcoming" empty="No upcoming jobs assigned to you." />
      <JobSection title="Past" when="past" empty="No past jobs yet." />
    </div>
  );
}

function JobSection({ title, when, empty }) {
  const { result, error, setPage } = usePaged("/api/jobs", `when=${when}`);

  return (
    <section className="space-y-3">
      <SectionHeader title={title} />
      {error ? (
        <ErrorMessage error={error} />
      ) : !result ? (
        <Loading variant="list" />
      ) : (
        <>
          <JobList jobs={result.items} showClient linkBase="/my-jobs" showMoney={false} empty={empty} />
          <Pagination page={result.page} pages={result.pages} onPage={setPage} />
        </>
      )}
    </section>
  );
}
