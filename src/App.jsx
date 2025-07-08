import * as React from "react";
import { createRoot } from "react-dom/client";
import { 
  Plus,
  Users,
  Buildings,
  NotePencil,
  Upload,
  Trash,
  Terminal,
  Play,
  Pause,
  Clock,
  Pencil
} from "@phosphor-icons/react";
import './App.css';

// Simple localStorage-based key-value hook to replace useKV
const useKV = (key, defaultValue) => {
  const [value, setValue] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  const setStoredValue = (newValue) => {
    try {
      setValue(newValue);
      window.localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return [value, setStoredValue];
};

// Helper function to format time
const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// CountdownTimer component to manage the hackathon timer
function CountdownTimer() {
  const [title, setTitle] = React.useState("Hackathon Time Remaining");
  const [isEditing, setIsEditing] = React.useState(false);
  const [totalSeconds, setTotalSeconds] = React.useState(3600); // Default: 1 hour
  const [initialSeconds, setInitialSeconds] = React.useState(3600); // Track initial time for progress
  const [isRunning, setIsRunning] = React.useState(false);
  const [isSettingTime, setIsSettingTime] = React.useState(false);
  const [hours, setHours] = React.useState("01");
  const [minutes, setMinutes] = React.useState("00");
  const [seconds, setSeconds] = React.useState("00");

  // Effect to handle the countdown logic
  React.useEffect(() => {
    let interval;
    if (isRunning && totalSeconds > 0) {
      interval = setInterval(() => {
        setTotalSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, totalSeconds]);

  // Handler to set the new time based on user input
  const handleTimeSet = () => {
    const newTotalSeconds = 
      parseInt(hours || "0") * 3600 + 
      parseInt(minutes || "0") * 60 + 
      parseInt(seconds || "0");
    setTotalSeconds(newTotalSeconds);
    setInitialSeconds(newTotalSeconds); // Update initial time for progress calculation
    setIsSettingTime(false);
  };

  // Calculate progress percentage (0-100) - reversed to show remaining time
  const progressPercentage = initialSeconds > 0 ? (totalSeconds / initialSeconds) * 100 : 0;

  return (
    <div className="card mb-6 bg-neutral-2 border-neutral-6">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              className="input bg-neutral-1 border-neutral-6"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-mono">{title}</h2>
              <button
                className="btn btn-plain text-neutral-11"
                onClick={() => setIsEditing(true)}
                aria-label="Edit title"
              >
                <Pencil />
              </button>
            </div>
          )}

          {isSettingTime && (
            <div className="dialog-overlay" onClick={() => setIsSettingTime(false)}>
              <div className="dialog bg-neutral-2 border-neutral-6" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                  <h3 className="dialog-title font-mono">$ set-timer --duration</h3>
                </div>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="HH"
                    value={hours}
                    onChange={(e) => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="input bg-neutral-1 border-neutral-6 w-20 text-center"
                  />
                  <span className="text-2xl">:</span>
                  <input
                    type="text"
                    placeholder="MM"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="input bg-neutral-1 border-neutral-6 w-20 text-center"
                  />
                  <span className="text-2xl">:</span>
                  <input
                    type="text"
                    placeholder="SS"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="input bg-neutral-1 border-neutral-6 w-20 text-center"
                  />
                </div>
                <div className="dialog-footer">
                  <button className="btn font-mono" onClick={() => setIsSettingTime(false)}>
                    $ cancel
                  </button>
                  <button className="btn btn-primary font-mono" onClick={handleTimeSet}>
                    $ set
                  </button>
                </div>
              </div>
            </div>
          )}

          <button className="btn font-mono" onClick={() => setIsSettingTime(true)}>
            <Clock />
            $ set-time
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-4xl font-mono font-bold">
            {formatTime(totalSeconds)}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-primary font-mono"
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause /> : <Play />}
              {isRunning ? '$ pause' : '$ start'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-container mb-2">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm font-mono text-neutral-11 mt-1">
          </div>
        </div>
      </div>
    </div>
  );
}

// TeamForm component for both adding and editing teams
function TeamForm({ team, onSubmit, onCancel, title, submitLabel }) {
  const [formData, setFormData] = React.useState(team);

  // Handler for drag and drop image upload
  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({...prev, logo: e.target.result}));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <>
      <div className="dialog-header">
        <h3 className="dialog-title font-mono">{title}</h3>
        <p className="dialog-description font-mono text-neutral-11">
          {team.id ? 'Edit team information' : 'Add a new team to the hackathon'}
        </p>
      </div>
      <div className="space-y-4">
        <div className="input-group">
          <Users />
          <input
            type="text"
            placeholder="Team Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
            className="input bg-neutral-1 border-neutral-6"
          />
        </div>
        <div className="input-group">
          <NotePencil />
          <input
            type="text"
            placeholder="Topic"
            value={formData.topic}
            onChange={(e) => setFormData(prev => ({...prev, topic: e.target.value}))}
            className="input bg-neutral-1 border-neutral-6"
          />
        </div>
        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
          className="textarea bg-neutral-1 border-neutral-6"
        />
        <div className="input-group">
          <Buildings />
          <input
            type="text"
            placeholder="Room"
            value={formData.room}
            onChange={(e) => setFormData(prev => ({...prev, room: e.target.value}))}
            className="input bg-neutral-1 border-neutral-6"
          />
        </div>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="upload-area border-2 border-dashed border-neutral-6 p-4 text-center cursor-pointer"
        >
          {formData.logo ? (
            <img src={formData.logo} alt="Team logo" className="mb-4 max-h-32 mx-auto" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-11">
              <Upload size={32} />
              <p className="font-mono">Drag and drop team logo here</p>
            </div>
          )}
        </div>
      </div>
      <div className="dialog-footer">
        <button className="btn font-mono" onClick={onCancel}>
          $ cancel
        </button>
        <button
          className="btn btn-primary font-mono"
          onClick={() => onSubmit(formData)}
          disabled={!formData.name || !formData.topic || !formData.room}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}

function App() {
  const [teams, setTeams] = useKV("hackathon-teams", []);
  const [isAddingTeam, setIsAddingTeam] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState(null);
  const [teamToDelete, setTeamToDelete] = React.useState(null);

  const emptyTeam = {
    name: "",
    topic: "",
    description: "",
    room: "",
    logo: null
  };

  // Handler to add a new team
  const addTeam = (teamData) => {
    setTeams([...teams, { ...teamData, id: Date.now() }]);
    setIsAddingTeam(false);
  };

  // Handler to update an existing team
  const updateTeam = (teamData) => {
    setTeams(teams.map(team => 
      team.id === teamData.id ? teamData : team
    ));
    setEditingTeam(null);
  };

  // Handler to delete a team
  const deleteTeam = () => {
    if (teamToDelete) {
      setTeams(teams.filter(team => team.id !== teamToDelete.id));
      setTeamToDelete(null);
    }
  };

  return (
    <div className="app">
      <div className="container min-h-[80vh]">
        {/* Header Section */}
        <div className="header flex justify-between items-center mb-6 bg-neutral-2 p-4 border border-neutral-6">
          <div className="flex items-center gap-2">
            <Terminal className="text-mint-11" size={24} />
            <h1 className="text-2xl font-bold font-mono">Hackathon Dashboard</h1>
          </div>
        </div>

        {/* Teams Section */}
        <section className="mb-6">
          <CountdownTimer />

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-mono">Registered Teams</h2>
            <button 
              className="btn btn-primary font-mono"
              onClick={() => setIsAddingTeam(true)}
            >
              <Plus />
              $ new-team
            </button>
          </div>

          {/* Add Team Dialog */}
          {isAddingTeam && (
            <div className="dialog-overlay" onClick={() => setIsAddingTeam(false)}>
              <div className="dialog bg-neutral-2 border-neutral-6" onClick={(e) => e.stopPropagation()}>
                <TeamForm
                  team={emptyTeam}
                  onSubmit={addTeam}
                  onCancel={() => setIsAddingTeam(false)}
                  title="$ create-team --new"
                  submitLabel="$ create"
                />
              </div>
            </div>
          )}

          {/* Delete Team Confirmation Dialog */}
          {teamToDelete && (
            <div className="dialog-overlay" onClick={() => setTeamToDelete(null)}>
              <div className="dialog bg-neutral-2 border-neutral-6" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                  <h3 className="dialog-title font-mono">$ delete-team --name "{teamToDelete?.name}"</h3>
                  <p className="dialog-description font-mono text-neutral-11">
                    Are you sure you want to delete this team? This action cannot be undone.
                  </p>
                </div>
                <div className="dialog-footer">
                  <button className="btn font-mono" onClick={() => setTeamToDelete(null)}>
                    $ cancel
                  </button>
                  <button
                    className="btn btn-danger font-mono"
                    onClick={deleteTeam}
                  >
                    $ delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Team Dialog */}
          {editingTeam && (
            <div className="dialog-overlay" onClick={() => setEditingTeam(null)}>
              <div className="dialog bg-neutral-2 border-neutral-6" onClick={(e) => e.stopPropagation()}>
                <TeamForm
                  team={editingTeam || emptyTeam}
                  onSubmit={updateTeam}
                  onCancel={() => setEditingTeam(null)}
                  title={`$ edit-team --name "${editingTeam?.name}"`}
                  submitLabel="$ update"
                />
              </div>
            </div>
          )}

          {/* Teams List */}
          {teams.length === 0 ? (
            <div className="text-center p-8 bg-neutral-2 border border-neutral-6">
              <p className="text-lg font-mono text-neutral-11">No teams registered yet</p>
              <p className="font-mono text-neutral-11">Click '$ new-team' to add one</p>
            </div>
          ) : (
            <div className="teams-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team => (
                <div key={team.id} className="card bg-neutral-2 border-neutral-6">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold font-mono">{team.name}</h3>
                        <p className="text-neutral-11 font-mono">{team.topic}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-plain text-neutral-11 hover:text-neutral-12"
                          onClick={() => setEditingTeam(team)}
                          aria-label="Edit team"
                        >
                          <Pencil />
                        </button>
                        <button
                          className="btn btn-plain text-red-9 hover:text-red-10"
                          onClick={() => setTeamToDelete(team)}
                          aria-label="Delete team"
                        >
                          <Trash />
                        </button>
                      </div>
                    </div>
                    {team.logo && (
                      <img src={team.logo} alt="Team logo" className="mb-4 max-h-32 mx-auto" />
                    )}
                    <p className="mb-2 text-sm text-neutral-11 font-mono">{team.description}</p>
                    <div className="flex items-center gap-2 text-neutral-11 font-mono">
                      <Buildings />
                      <span>Room: {team.room}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
