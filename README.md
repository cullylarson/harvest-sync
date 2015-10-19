# harvest-sync

> Syncs timesheets between two Harvest accounts.

## General

Syncs are only done one way: from the source to the destination.
Timesheets will never be copied from the destination to the source.

Syncs are performed by providing a `Client / Project / Task` on the
source account, and a corresponding `Client / Project / Task` on
the destination account.  If any `Client / Project / Task`
timesheets are found on the source that are not found in the
corresponding `Client / Project / Task` on the destination, then
those timesheets will be sent to the destination.

When the timesheets are copied to the destination, they will have
the destination `Client / Project / Task`.  However, the hours,
notes, and date will be the same as on the source.

So, for example:

|              | *Source*             | *Destination*     |
| ------------ | -------------------- | ----------------- |
| **Client**   | Source Client Name   | Dest Client Name  |
| **Project**  | Source Project Name  | Dest Project Name |
| **Task**     | Source Task Name     | Dest Task Name    |
| **Date**     | 2015-10-18           | 2015-10-18        |
| **Hours**    | 3:15                 | 3:15              |
| **Notes**    | A simple note.       | A simple note.    |


## Install

```
$ npm install -g harvest-sync
```

## Usage

1. Create a config file (see "Config" section).

1. Run the `harvest-sync` command:

```
$ harvest-sync path/to/config-file.json
```

NOTE: `harvest-sync` will show you what it plans to do and ask you to confirm
before actually doing anything, so you can run it without making any changes
to your Harvest time-sheets.

### Listing Clients, Project, and Tasks

There's a sub-command that allows you to list details about a Harvest account.
Just provide the config .json file as normal, and also pass the --list parameter.
This parameter is of the form: `(source|dest).(clients|projects|tasks)`.

For example:

```
$ harvest-sync --list dest.clients path/to/config-file.json
$ harvest-sync --list source.tasks path/to/config-file.json
```

### Generate a Config File

There's a sub-command that allows you to generate a config file by answering
some questions:

```
$ harvest-sync config
```

## Config

Configuration is done using a .json file that is passed to the `harvest-sync` command.
This allows you to perform different syncs, using different .config files.

### Parameters

* __source__ (_object_) Credentials for the source account.
    * __subdomain__ (_string_) Your account' subdomain. Don't include the _https://_ portion, nor a trailing _/_.
    * __email__ (_string_) The email address used to log into your account.
    * __password__ (_string_) The password used to log into your account.
* __dest__ (_object_) Credentials for the destination account.
    * __subdomain__ (_string_)
    * __email__ (_string_)
    * __password__ (_string_)
* __start__ (_string_) The date to start searching your Harvest account.  This is here because the program
doesn't know how far back to look for times.  The further back this date, the longer the command will take
(since it will have to compare timesheets for more days).
* __sync__ (_object_) You can define multiple syncs values.  Each item in this object is a key/value pair.
They are all in the format: "Client Name / Project Name / Task Name".  If any of those names includes a "/",
you can escape it as "//". So, for example: "Client // Name / Project Name / Task Name".
    * _key_ Each key is the source client, project, and task
    * _value_ Each value is the destination client, project, and task that corresponds to those of the source.

### Example

```
{
  "source": {
    "subdomain": "mydomain.harvestapp.com",
    "email": "me@example.com",
    "password": "asdf"
  },
  "dest": {
    "subdomain": "anotherdomain.harvestapp.com",
    "email": "company@example.com",
    "password": "qwer"
  },
  "start": "2015-09-01",
  "sync": {
    "Source Client Name 1 / Source Project Name 1 / Source Task Name 1": "Dest Client Name 1 / Dest Project Name 1 / Dest Task Name 1",
    "Source Client Name 2 / Source Project Name 2 / Source Task Name 2": "Dest Client Name 2 / Dest Project Name 2 / Dest Task Name 2"
  }
}
```

This would do the following, for each sync defined:

1. Find all timesheets on the source with `Source Client Name 1 / Source Project Name 1
/ Source Task Name 1`

1. Compare them to all timesheets on the destination with `Dest Client Name 1 /
Dest Project Name 1 / Dest Task Name 1`

1. Timesheets will be considered equal if they have corresponding client, project, and
task values, and their dates and hours are the same.

1. If any are found on the source account, but not on the destination, they will be
copied from the source to the destination, under `Dest Client Name 1 / Dest Project
Name 1 / Dest Task Name 1`, but with the same date, hours, and notes.

## License

MIT © Cully Larson