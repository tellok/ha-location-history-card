# Location History Card for Home Assistant

<img src="custom_components/location_history_card/brand/icon.png" alt="Location History Card icon" width="112" height="112">

Replay the positions Home Assistant Recorder saved for people and device trackers. The card uses Home Assistant's map, fills a Panel view, and lets you scrub the day or play back a selected time range.

**Common uses**

- **Make a travel route guide.** Let Home Assistant record your route as you travel, then use the card to retrace your stops and map out a route guide to share with friends.
- **Revisit an outing.** Replay a hike, bike ride, or road trip to see where you went and when you stopped.
- **See when you met up.** View your track alongside a family member's or friend's on the same timeline to see where and when your routes came together.

[![Open Location History Card in Home Assistant](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=tellok&repository=ha-location-history-card&category=integration)

> [!TIP]
> **See your family and friends on the map.** The [ha-apple-find](https://github.com/tellok/ha-apple-find) integration automatically updates locations in Home Assistant for family members and friends who share their location with you through Apple Find My. Use this card to see their latest recorded locations and replay their routes.

## Screenshots

These screenshots use fictional people and tracks around Central Park.

### Desktop Panel

![The desktop Panel view, with three colored tracks on the map and a shared timeline below](docs/images/desktop.webp)

### Playback range

![Timeline with three movement rows, an orange range bounded by draggable handles, and a blue playhead](docs/images/timeline.webp)

### Mobile Panel

<img src="docs/images/mobile.webp" alt="The mobile Panel view in dark mode, with a map above the timeline and playback controls" width="360">

## Install

Requires Home Assistant 2026.11.1 or later, with the built-in Marketplace.

1. Open **Settings → Marketplace** and search for **Location History Card**. If it does not appear, choose **Add from link** and enter `https://github.com/tellok/ha-location-history-card`.
2. Install **Location History Card**. Restart Home Assistant if prompted.
3. Go to **Settings → Devices & services → Add integration → Location History Card**. The integration registers the JavaScript module automatically when Lovelace resources are managed in storage mode.
4. Refresh the dashboard and add **Location History** from the card picker. For a full-screen map, use a **Panel** view with one card.

If you already have a local installation with the `location_history_card` domain, install the Marketplace release over it. Home Assistant reuses the existing integration entry, and the card type stays `custom:location-history-card`.

## Use the card

The minimum manual card configuration is:

```yaml
type: custom:location-history-card
```

The card replays recorded coordinates for `device_tracker` entities and `person` entities linked to a tracker that provides coordinates. It includes people automatically and shows people linked to trackers that report coordinates or identify themselves as GPS trackers by default. In a storage-mode dashboard, administrators can open **Manage entities** to add device trackers or remove people from the card. Use the eye beside an entity to toggle its map and timeline visibility. Your browser remembers those choices for your Home Assistant account.

Whenever the card needs initials, it splits the display name using the same rules. English and other space-separated scripts use whitespace to separate name parts. Chinese, Japanese, Korean, Thai, Lao, Khmer, and Burmese scripts count each displayed character as a part, keeping attached marks with their character. For example, `John Smith` has two parts and `欧阳小明` has four. The card keeps the order of the display name.

Person and device tracker markers show the entity's current Home Assistant avatar when available, even during playback. A single visible marker without a current avatar shows the full name. With multiple visible markers, a text marker uses the first part's initial. That is the given name's initial in given-name-first order (`John Smith` → `J`) or the first character of the surname in Chinese surname-first order (`欧阳小明` → `欧`). When text markers share an initial:

- Names in space-separated scripts such as English show the complete given name, including any middle names. The last part is treated as the surname when the name has two or more parts. If the given names match, the map shows the full names with their surnames.
- Names containing characters from the character-based scripts above use an initial from each name part. If the resulting initials match, the map shows the full name.

When an entity has no current name, the card can use the name saved with its location history. Nearby markers cluster together. Select a cluster to reach its members, including people recorded at the same location.

Drag anywhere in the timeline to seek. Drag either orange handle to trim playback, or move the playhead beyond a handle to extend the range. Faded tracks give context outside the range. **Fit selected time range** frames the recorded points within the range for the visible entities.

You can optionally add these card settings:

```yaml
type: custom:location-history-card
entities:
  - device_tracker.example_phone
excluded_people:
  - person.example
movement_threshold: 50
show_trails: true
```

Use the date range picker above the timeline to choose one day or many (Today, Yesterday, This week and the other presets, or any dates on the calendar). All trails in the range are drawn at once; press **Play** to replay them from the start of the range.

`movement_threshold` is the minimum displacement in metres used to identify movement periods on the timeline. The map draws consecutive distinct Recorder positions with straight lines. The available dates and coordinates depend on your Recorder retention and what your trackers report.

Licensed under the [MIT License](LICENSE).
