"""Rough progression simulation for the economy plan (docs/ECONOMY.md).

One player, no stealing, collects base income after every trip. Each trip goes to the
best zone the car can reach and carry, catches a full load, replaces the weakest base
habali (the replaced one is sold to Abu Habal), and buys the next upgrade it can afford.
Run: python -I tools/economy_sim.py
"""

RARITIES = ["Common", "Rare", "VeryRare", "Legendary"]
INCOME = {"Common": 1, "Rare": 4, "VeryRare": 15, "Legendary": 50}  # BaseConfig.Income
WEIGHT = {"Common": 1, "Rare": 2, "VeryRare": 4, "Legendary": 6}  # CatchConfig.Weight
ZONE = {"Common": (260, 1000), "Rare": (1000, 1900), "VeryRare": (1900, 2700), "Legendary": (2700, 3400)}
HITS = {"Common": 3, "Rare": 5, "VeryRare": 8, "Legendary": 12}  # agal level 1
SHOTS = {"Common": 1, "Rare": 1, "VeryRare": 2, "Legendary": 3}  # gun level 1
VARIANT_EV = 0.965 + 0.03 * 3 + 0.005 * 10  # average income multiplier from gold/diamond
SLOTS = 10
# How often a habali of each rarity frees up for one player: alive cap and respawn delay
# per server (HabaliConfig), shared with the other players hunting the same zone.
CAP = {"Common": 14, "Rare": 8, "VeryRare": 3, "Legendary": 1}  # proposed (now 4 / 2)
RESPAWN = {"Common": 10, "Rare": 30, "VeryRare": 180, "Legendary": 600}  # proposed (now 20/40/60)
SHARERS = {"Common": 3, "Rare": 3, "VeryRare": 3, "Legendary": 3}
SELL_SECONDS = 300  # Abu Habal pays this many seconds of the habali's income
FUEL_PER_STUD = 0.04  # money per stud driven

# Shop ladders: (name, value, price). Level 1 is free.
AGAL = [("عقال", 1.0, 0), ("عقال مقصّب", 0.7, 2_000), ("شبشب أم فهد", 0.5, 60_000), ("العقال الذهبي", 0.35, 2_500_000)]
GUN = [("مسدس تنويم", 1.0, 0), ("بندقية تنويم", 0.75, 15_000), ("قاذف النعاس", 0.5, 900_000)]
ENGINE = [(40, 0), (48, 3_000), (56, 40_000), (66, 500_000), (80, 4_000_000)]
LOAD = [(3, 0), (4, 6_000), (6, 150_000), (8, 1_200_000), (10, 8_000_000)]
TANK = [(5_000, 0), (7_500, 5_000), (10_000, 100_000), (14_000, 900_000)]


def simulate(hours=80, verbose=True):
    t, money = 0.0, 0.0
    base = []  # incomes of habali on the platforms
    lv = {"agal": 0, "gun": 0, "engine": 0, "load": 0, "tank": 0}
    best_caught = None
    events = []

    def log(text):
        events.append((t, text))

    def reachable(rarity):
        outer = ZONE[rarity][1]
        return WEIGHT[rarity] <= LOAD[lv["load"]][0] and TANK[lv["tank"]][0] >= outer * 2 * 1.15

    while t < hours * 3600:
        target = [r for r in RARITIES if reachable(r)][-1]
        if target != best_caught:
            best_caught = target
            log(f"first trip to {target}")
        count = LOAD[lv["load"]][0] // WEIGHT[target]
        speed = ENGINE[lv["engine"]][0]
        mid = sum(ZONE[target]) / 2
        drive = 2 * mid / speed + count * 15  # there, back, short hops between habali
        knock = min(HITS[target] * 0.4 * AGAL[lv["agal"]][1], SHOTS[target] * 2.5 * GUN[lv["gun"]][1])
        find = max(25, SHARERS[target] * RESPAWN[target] / CAP[target])
        per_catch = find + knock + 10  # find, knock out, drag and load
        trip = drive + count * per_catch + 20  # unload and collect
        fuel = 2 * mid * 1.15 * FUEL_PER_STUD
        income = sum(base)
        t += trip
        money += income * trip - fuel
        for _ in range(count):
            value = INCOME[target] * VARIANT_EV
            if len(base) < SLOTS:
                base.append(value)
            else:
                base.sort()
                if value > base[0]:
                    money += base[0] * SELL_SECONDS
                    base[0] = value
                else:
                    money += value * SELL_SECONDS
        # buy: what unlocks the next zone first, then the weapon for the current zone, then speed
        nxt = RARITIES[min(RARITIES.index(target) + 1, 3)]
        order = []
        if WEIGHT[nxt] > LOAD[lv["load"]][0]:
            order.append(("load", LOAD))
        if TANK[lv["tank"]][0] < ZONE[nxt][1] * 2 * 1.15:
            order.append(("tank", TANK))
        order += [("agal", AGAL), ("gun", GUN), ("engine", ENGINE), ("load", LOAD), ("tank", TANK)]
        for key, ladder in order:
            if lv[key] + 1 < len(ladder):
                price = ladder[lv[key] + 1][-1]
                if money >= price:
                    money -= price
                    lv[key] += 1
                    log(f"bought {key} level {lv[key] + 1} for {price:,} (income {sum(base):.0f}/s)")
                    break
        if all(lv[k] + 1 == len(l) for k, l in [("agal", AGAL), ("gun", GUN), ("engine", ENGINE), ("load", LOAD), ("tank", TANK)]):
            log(f"everything bought, money {money:,.0f}, income {sum(base):.0f}/s")
            break
    if verbose:
        for when, text in events:
            print(f"{when / 60:7.1f} min  {text}")
    return events


if __name__ == "__main__":
    simulate()
